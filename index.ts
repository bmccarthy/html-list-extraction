import { Chromeless } from 'chromeless';

export class Test {
  private chromeless: Chromeless<any>;

  constructor() {
    this.chromeless = new Chromeless({ launchChrome: false })
  }

  getElements(url): Promise<any[]> {

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
              e: bounding.width,
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

async function run() {
  const t = new Test();
  const elements = await t.getElements("http://newhopewinery.com/live-music/");

  await t.end();

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
        if (child.id !== children[j].id && child.tagName === children[j].tagName) {
          // list.push(child);
          list.push(children[j]);
        }
      }

      // return list where child is a member
      queue.push(child);
    }
  }

  console.log(list);
}

run().catch(console.error.bind(console))