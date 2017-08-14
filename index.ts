import { Chromeless } from 'chromeless';

export interface MyNode {
  id: number; // id number
  tag: string; // html tag
  h: string; // outer html
  t: string; // inner text
  cl: string[]; // css classes
  b: { h: number; w: number; t: number; l: number; }; // client bounding box
  children: number[]; // children id's
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

  getElements(url): Promise<MyNode[]> {

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
      .then((elementString: string) => JSON.parse(elementString));
  }

  end(): Promise<any> {
    return this.chromeless.end()
  }
}

export function unique(arr: MyNode[], func: (a: MyNode) => string) {
  const flags = {};

  return arr.filter((entry) => {
    if (flags[func(entry)]) {
      return false;
    }

    flags[func(entry)] = true;
    return true;
  });
}

function isNodeEligible(node: MyNode): boolean {
  return node.b.h > 0 && node.b.w > 0 && node.t.replace(/\s/g, "") !== "" &&
    (node.children.length > 0 || node.t.split(' ').length > 2);
}

function nodeFilter(nodeA: MyNode, nodeB: MyNode): boolean {
  return isNodeEligible(nodeA) && isNodeEligible(nodeB) &&
    nodeA.id !== nodeB.id && nodeA.tag === nodeB.tag;
}

function getListItems(parent: MyNode) {

}

async function run() {
  const t = new Test();
  const elements = await t.getElements("http://newhopewinery.com/live-music/");
  const page = {};
  elements.forEach(element => page[element.id] = element);

  const queue = [page[0]];

  const list = [];

  while (queue.length > 0) {
    const item = queue.shift();

    let children = item.children.map(c => page[c]);

    for (let i = 0; i < children.length; i++) {
      const child = children[i];

      for (let j = 0; j < children.length; j++) {
        if (nodeFilter(child, children[j])) {
          list.push(child);
          list.push(children[j]);
        }
      }

      // return list where child is a member
      queue.push(child);
    }
  }

  const uniqueList = unique(list, item => item.id.toString());
  const ids = uniqueList.map(c => c.id);

  console.log(uniqueList);

  await t.highlight(ids);
  const screenshotPath = await t.screenshot();
  console.log(screenshotPath);

  await t.end();
}

run().catch(console.error.bind(console))