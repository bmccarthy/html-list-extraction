import * as Puppeteer from 'puppeteer';
import * as ed from 'edit-distance';
import * as parseDomain from 'parse-domain';

export interface Page {
  [id: number]: MyNode;
}

export interface MyNode {
  id: number; // id number
  tag: string; // html tag
  h: string; // outer html
  t: string; // inner text
  c: string[]; // css classes
  b: { h: number; w: number; t: number; l: number; }; // client bounding box
  children: number[]; // children ids
  computedStyle: { backgroundColor: string; fontFamily: string; fontSize: string; fontWeight: string; visibility: string; color: string; };
}

export class Test {
  private page: any;
  private browser: any;

  async highlight(ids: number[]) {
    await this.page.evaluate((arr) => {
      for (let i = 0; i < arr.length; i++) {
        const elements = document.querySelectorAll(`[data-osc-id="${arr[i]}"]`);
        if (elements.length > 0) {
          elements[0]['style']["border"] = '1px solid red';
        }
      }
    }, ids);
  }

  async screenshot(filename) {
    return await this.page.screenshot({ fullPage: true, path: filename });
  }

  async getElements(url): Promise<Page> {

    this.browser = await Puppeteer.launch({ headless: false, args: ['--no-sandbox'] });
    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1400, height: 900 });

    await this.page.goto(url, { waitUntil: 'networkidle' });
    const elementsString = await this.page.evaluate(() => {
      const SKIP_TAGS = ["SCRIPT", "LINK", "STYLE", "BR", "SELECT", "OPTION"];
      const nodes = [];
      let id = 0;
      const queue: any[] = [{ id: id, node: document.body }];

      function getFeatures(node) {
        const computedStyle = getComputedStyle(node);

        const STYLES = [
          "backgroundColor",
          "fontFamily",
          "fontSize",
          "fontStyle",
          "fontWeight",
          "visibility",
          "color"
        ];

        let filteredComputedStyle = {};
        STYLES.forEach(style => {
          filteredComputedStyle[style] = computedStyle[style];
        });

        const bounding = node.getBoundingClientRect();

        return {
          tag: node.tagName,
          h: node.outerHTML,
          t: node.innerText,
          computedStyle: filteredComputedStyle,
          cl: [].slice.call(node.classList),
          b: {
            h: bounding.height,
            w: bounding.width,
            t: bounding.top,
            l: bounding.left
          }
        };
      }

      while (queue.length > 0) {
        const item = queue.shift();

        let features: any = getFeatures(item.node);
        features.id = item.id;
        features.children = [];

        item.node.dataset.oscId = item.id

        for (let i = 0; i < item.node.children.length; i++) {
          if (SKIP_TAGS.indexOf(item.node.children[i].tagName) === -1) {
            queue.push({ id: ++id, node: item.node.children[i] });
            features.children.push(id);
          }
        }

        nodes.push(features);
      }

      return JSON.stringify(nodes)
    });

    const elements = JSON.parse(elementsString);

    const page: Page = {};
    elements.forEach(element => page[element.id] = element);

    // add a default node with 0 children and no tag name
    page["-1"] = { children: [], id: -1, tag: '', t: '', h: '' };

    return page;
  }

  end() {
    // this.browser.close();
  }
}

function isNodeEligible(node: MyNode): boolean {
  return node.b.h > 0 && node.b.w > 0 && node.t.replace(/\s/g, "") !== "" &&
    (node.children.length > 0 || node.t.split(' ').length > 2);
}

/**
 * Return a list of all siblings of node childId which appear to be list items with childId
 * @param page 
 * @param parentId 
 * @param childId 
 */
function getListForNode(page: Page, parentId: number, childId: number): number[] {
  const list: number[] = [];
  const parentNode = page[parentId];
  const childNode = page[childId];
  const siblingNodes = parentNode.children.filter(siblingId => siblingId !== childId).map(siblingId => page[siblingId]);

  // if child node is not possible to be a list item (0 height or width), we can end early
  if (!isNodeEligible(childNode)) return [];

  const threshold = 20;
  const maxEditDistance = getTreeEditDistance(page, childNode.id, -1);

  siblingNodes.forEach(siblingNode => {
    const editDistance = getTreeEditDistance(page, childNode.id, siblingNode.id)
    const ted = editDistance / maxEditDistance;

    if (isNodeEligible(siblingNode) && childNode.tag === siblingNode.tag && editDistance < threshold) {
      list.push(siblingNode.id);
    }
  });

  if (list.length > 0) list.unshift(childNode.id);

  return list;
}

function isListsEqual(listA: number[], listB: number[]): boolean {
  if (listA.sort().join(',') === listB.sort().join(',')) {
    return true;
  }

  return false;
}

function doesListExistInOtherList(listA: number[], lists: number[][]): boolean {
  return !!lists.find(list => isListsEqual(list, listA));
}

function getAllListsForParent(page: Page, parent: number) {
  const lists: number[][] = [];

  page[parent].children.forEach(child => {

    const list = getListForNode(page, parent, child);

    if (list.length > 0 && !doesListExistInOtherList(list, lists)) {
      lists.push(list);
    }

  });

  return lists;
}

async function run() {
  const url = "https://www.stnj.org/events/upcoming-events";

  const t = new Test();
  const page = await t.getElements(url);

  const queue: number[] = [0]; // start queue with root node
  let lists: number[][] = [];

  while (queue.length > 0) {
    const item = queue.shift();

    const newLists = getAllListsForParent(page, item);
    if (newLists.length > 0) {
      lists = [...newLists, ...lists];
    }

    page[item].children.forEach(child => queue.push(child));
  }

  const ids = [].concat(...lists);
  await t.highlight(ids);
  await t.screenshot(`./images/${parseDomain(url).domain}.jpg`);

  t.end();
}

function getTreeEditDistance(page: Page, rootA: number, rootB: number): number {
  // Define cost functions.
  const insert = (node: MyNode) => 1;
  const remove = (node: MyNode) => 1;
  const update = (nodeA: MyNode, nodeB: MyNode) => { return nodeA.id !== nodeB.id ? 1 : 0; };
  const children = (node: MyNode) => node.children.map(c => page[c]);

  // Compute edit distance, mapping, and alignment.
  const ted = ed.ted(page[rootA], page[rootB], children, insert, remove, update);

  return ted.distance;
}

run().catch(console.error.bind(console))
