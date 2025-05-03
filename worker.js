const addResourcesToCache = async (resources) => {
    const cache = await caches.open("v1");
    await cache.addAll(resources);
};

self.addEventListener("install", (event) => {
    event.waitUntil(
        addResourcesToCache([
            "/",
            "/style.css",
            "/script.js",
            "/edit-avatar.js",
            "/IosevkaAile-Regular.woff2",
            "/IosevkaAile-Bold.woff2",
        ])
    );
});

// self.addEventListener("activate", function (event) {
//     console.log("SW activated");
// });
self.addEventListener("fetch", function (event) {
    console.log("Caught a fetch!", event.request);
    if (event.request.url.endsWith("/register-sw.js")) {
        console.log("lol");
        event.respondWith(new Response(""));
        return;
    }
    event.respondWith(caches.match(event.request.url.split("?")[0].split("#")[0]));
});