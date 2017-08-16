import { Chromeless } from 'chromeless';
const ed = require('edit-distance');

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
  private chromeless: Chromeless<any>;

  constructor() {
    this.chromeless = new Chromeless({ launchChrome: false })
  }

  getHtml() {
    return this.chromeless.html();
  }

  highlight(ids: number[]) {
    return this.chromeless.evaluate((arr) => {
      for (let i = 0; i < arr.length; i++) {
        document.querySelectorAll(`[data-osc-id="${arr[i]}"]`)[0]['style']["border"] = '5px solid red';
      }
    }, ids);
  }

  screenshot() {
    return this.chromeless.screenshot();
  }

  getElements(url): Promise<Page> {

    return this.chromeless
      .goto(url)
      .wait(2000) // todo: waiting 2s makes computedStyle.visbility = visible instead of hidden
      .evaluate(() => {
        const SKIP_TAGS = ["SCRIPT", "LINK", "STYLE"];
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
      })
      .then((elementString: string) => {
        const elements = JSON.parse(elementString);

        const page: Page = {};
        elements.forEach(element => page[element.id] = element);

        return page;
      });
  }

  end(): Promise<any> {
    return this.chromeless.end()
  }
}

function isNodeEligible(node: MyNode): boolean {
  return node.b.h > 0 && node.b.w > 0 && node.t.replace(/\s/g, "") !== "" &&
    (node.children.length > 0 || node.t.split(' ').length > 2);
}

function getListForNode(page: Page, nodeId: number): number[] {
  const list: number[] = [];
  const node = page[nodeId];
  const siblings = node.children.map(c => page[c]);

  for (let i = 0; i < siblings.length; i++) {
    if (node.id === siblings[i].id) continue;

    const ted = getTreeEditDistance(page, node.id, siblings[i].id);

    if (isNodeEligible(node) && isNodeEligible(siblings[i]) && node.tag === siblings[i].tag) {
      list.push(siblings[i].id);
    }
  }

  if (list.length > 0) list.unshift(node.id);

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

    const list = getListForNode(page, child);

    if (list.length > 0 && !doesListExistInOtherList(list, lists)) {
      lists.push(list);
    }

  });

  return lists;
}

async function run() {
  const t = new Test();
  const page = await t.getElements("http://newhopewinery.com/live-music/");

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
  const screenshotPath = await t.screenshot();
  console.log(screenshotPath);

  await t.end();
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