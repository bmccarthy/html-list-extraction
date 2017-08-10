const { Chromeless } = require('chromeless')

async function run() {
    const chromeless = new Chromeless({ launchChrome: false })

    const linksString = await chromeless
        // .setViewport({ width: 1895, height: 10000, scale: 1 })
        .goto('http://newhopewinery.com/live-music')
        .wait(2000) // todo: waiting 2s makes computedStyle.visbility = visible instead of hidden
        .evaluate(() => {
            const SKIP_TAGS = ["SCRIPT"];
            const messages = [];
            const queue = [document.body];

            while (queue.length > 0) {
                const node = queue.shift();
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

                messages.push({
                    t: node.tagName,
                    computedStyle: filteredComputedStyle,
                    ch: node.offsetHeight,
                    p: { l: node.offsetLeft, t: node.offsetTop },
                    cl: [].slice.call(node.classList),
                    b: {
                        height: bounding.height,
                        width: bounding.width,
                        top: bounding.top,
                        left: bounding.left
                    },
                    h: node.href
                });

                for (let i = 0; i < node.children.length; i++) {
                    if (SKIP_TAGS.indexOf(node.children[i].tagName) === -1) {
                        queue.push(node.children[i]);
                    }
                }
            }

            return JSON.stringify(messages)
        });

    const screenshot = await chromeless.screenshot();

    const elements = JSON.parse(linksString);
    const links = elements.filter(c => c.cl.indexOf("event_date") >= 0);
    // const links = elements.filter(c => c.t === "A" && c.href.indexOf("http://newhopewinery.com/eventbrite-event/chris-smither") === 0);
    console.log(links);

    console.log(`${links.length} # of links`);
    console.log(screenshot);

    await chromeless.end()
}

run().catch(console.error.bind(console))