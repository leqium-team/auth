navigator.serviceWorker.getRegistrations().then(registrations => {
    if (registrations.length == 0) {
        navigator.serviceWorker.register("worker.js", { scope: "./" }).then(function (sw) {
            console.log("Service worker registered");
        }).catch(function (err) {
            console.error("Failed to register service worker", err);
        });
    }
});


