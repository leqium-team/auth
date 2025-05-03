function getParameter(name, url = window.location.href) {
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return "";
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}

function escapeHTML(s) {
    return s.replace(
        /[^0-9A-Za-z \n]/g,
        c => "&#" + c.charCodeAt(0) + ";"
    );
}

function isNickname(str) {
    return /^[a-zA-Z_0-9]*$/.test(str);
}

const magicNumber = [76, 81, 73, 68];

function parseProfileFile(file) {
    var reader = new FileReader();
    var fileArray = [];
    reader.readAsArrayBuffer(file);
    reader.onloadend = async function (evt) {
        if (evt.target.readyState == FileReader.DONE) {
            const bytes = new Uint8Array(evt.target.result);
            let offset = 0;
            let magicPart = bytes.slice(offset, offset += 4);
            if (!(magicNumber.length === magicPart.length && magicNumber.every((value, index) => value === magicPart[index]))) {
                console.error("Failed to check magic number");
                return;
            }

            const publicKeyLengthBytes = bytes.slice(offset, offset += 2);
            const publicKeyBytes = bytes.slice(offset, offset += publicKeyLengthBytes[0] * 0x100 + publicKeyLengthBytes[1]);
            const publicKey = await window.crypto.subtle.importKey("spki", publicKeyBytes, {name: "RSA-PSS", hash: "SHA-256"}, true, ["verify"]);
            console.log(publicKey);

            const privateKeyLengthBytes = bytes.slice(offset, offset += 2);
            const privateKeyBytes = bytes.slice(offset, offset += privateKeyLengthBytes[0] * 0x100 + privateKeyLengthBytes[1]);
            const privateKey = await window.crypto.subtle.importKey("pkcs8", privateKeyBytes, {name: "RSA-PSS", hash: "SHA-256"}, true, ["sign"]);
            console.log(privateKey);

            const nicknameLength = bytes.slice(offset, offset += 1)[0];
            const nicknameBytes = bytes.slice(offset, offset += nicknameLength);
            let nickname = "";
            for (const byte of nicknameBytes) {
                nickname += String.fromCharCode(byte);
            }
            console.log(nickname);

            const bioLengthBytes = bytes.slice(offset, offset += 2);
            const decoder = new TextDecoder();
            const bio = decoder.decode(bytes.slice(offset, offset += bioLengthBytes[0] * 0x100 + bioLengthBytes[1]));

            const avatar = bytes.slice(offset, bytes.length - offset);

            let profile = {publicKey: publicKey, privateKey: privateKey, nickname: nickname, bio: bio, avatar: avatar};
            let same = findByNickname(nickname);
            if (!same) {
                saveProfile(profile);
                refreshProfiles();
                selectProfile(nickname);
            }
        }
    }
}

function saveProfile(profile) {
    allProfiles.push(profile);
    var req = indexedDB.open("profiles", 1);
    req.onsuccess = function (e) {
        db = this.result;
        let transaction = db.transaction("profiles", "readwrite");
        let profiles = transaction.objectStore("profiles");
        profiles.add(profile);
        profiles.oncomplete = function () {
            loadProfiles();
        }
    };
    req.onupgradeneeded = function() {
        let db = this.result;
        if (!db.objectStoreNames.contains("profiles")) {
            db.createObjectStore("profiles", {keyPath: "nickname"});
        }
    };
    req.onerror = function (e) {
        console.error("Failed to load profiles db", e.target.errorCode);
    };
}

let allProfiles = [];
function findByNickname(nickname) {
    return allProfiles.find((profile) => profile.nickname == nickname);
}
let currentNickname;

function refreshProfiles() {
    let dropdownHTML = "";
    allProfiles.forEach((profile) => {
        console.log(profile);
        let base64Avatar = URL.createObjectURL(new Blob([profile.avatar], { type: "image/png" }));
        dropdownHTML += `<button id="${escapeHTML(profile.nickname)}-profile" disabled><div class="avatar" style="background-image: url(${base64Avatar})"></div>${escapeHTML(profile.nickname)}</button>`;
    });
    document.querySelector("#account-select .dropdown").innerHTML = dropdownHTML + `<button id="new-profile" disabled><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>New Profile</button><button id="import-profile" disabled><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M12 18v-6"/><path d="m9 15 3 3 3-3"/></svg>Import Profile</button>`;
    addAccountButtonsListeners();
}

function openCreateProfile() {
    document.querySelector(".create-profile").classList.remove("hidden");
    document.querySelector(".authorize").classList.add("hidden");
}
function closeCreateProfile() {
    document.querySelector(".create-profile").classList.add("hidden");
    document.querySelector(".authorize").classList.remove("hidden");
}

function loadProfiles() {
    var req = indexedDB.open("profiles", 1);
    req.onsuccess = function (e) {
        db = this.result;
        let transaction = db.transaction("profiles", "readonly");
        let profiles = transaction.objectStore("profiles");
        let allProfilesRequest = profiles.getAll();
        allProfilesRequest.onsuccess = () => {
            allProfiles = allProfilesRequest.result;
            refreshProfiles();
            selectProfile(window.localStorage.getItem("lastProfile"));
        }
    };
    req.onupgradeneeded = function() {
        let db = this.result;
        if (!db.objectStoreNames.contains("profiles")) {
            db.createObjectStore("profiles", {keyPath: "nickname"});
        }
    };
    req.onerror = function (e) {
        console.error("Failed to load profiles db", e.target.errorCode);
    };
}

async function createProfile(nickname, bio) {
    if (nickname.length > 32) { // Technically, nickname can be 255, but must comfortable for users are not greater than 32.
        console.error("Nickname bigger than 32 symbols");
        return;
    }
    if (!isNickname(nickname)) {
        console.error("Nickname should contain only A-Z (Latin) symbols, 0-9 (digits) and _ (underscore)");
        return;
    }
    if (bio.length > 1000) { // Technical limit: 65354
        console.error("Bio can't be larger 1000 symbols");
        return;
    }
    const keyPair = await window.crypto.subtle.generateKey(
        {
            name: "RSA-PSS",
            modulusLength: 4096,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256",
        },
        true,
        ["sign", "verify"],
    );
    console.log(keyPair);

    const publicKeyBytes = new Uint8Array(await window.crypto.subtle.exportKey("spki", keyPair.publicKey));
    const privateKeyBytes = new Uint8Array(await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey));

    const nicknameBytes = new Uint8Array(nickname.length);
    for (var i = 0; i < nickname.length; i++) {
        nicknameBytes[i] = nickname.charCodeAt(i);
    }

    const encoder = new TextEncoder();
    const bioBytes = encoder.encode(bio);

    let avatarBytes = ((editedAvatar) ? editedAvatar : new Uint8Array(0));

    bytes = new Uint8Array(4 + 2 + publicKeyBytes.length + 2 + privateKeyBytes.length + 1 + nicknameBytes.length + 2 + bioBytes.length + avatarBytes.length);
    let offset = 0;

    bytes.set([76, 81, 73, 68], offset);  // Magic number (LQID)
    offset += 4;

    bytes.set([publicKeyBytes.length >> 8 & 0xFF, publicKeyBytes.length & 0xFF], offset);
    offset += 2;
    bytes.set(publicKeyBytes, offset);
    offset += publicKeyBytes.length;

    bytes.set([privateKeyBytes.length >> 8 & 0xFF, privateKeyBytes.length & 0xFF], offset);
    offset += 2;
    bytes.set(privateKeyBytes, offset);
    offset += privateKeyBytes.length;

    bytes.set([nickname.length], offset);
    offset += 1;
    bytes.set(nicknameBytes, offset);
    offset += nicknameBytes.length;

    bytes.set([bioBytes.length >> 8 & 0xFF, bioBytes.length & 0xFF], offset);
    offset += 2;
    bytes.set(bioBytes, offset);
    offset += bioBytes.length;

    bytes.set(avatarBytes, offset);


    saveBinaryFile([bytes], `${nickname}.leqium`);
    let profile = {publicKey: keyPair.publicKey, privateKey: keyPair.privateKey, nickname: nickname, bio: bio, avatar: avatarBytes};
    saveProfile(profile);
    refreshProfiles();
    selectProfile(nickname);
}

var saveBinaryFile = (function () {
    var a = document.createElement("a");
    document.body.appendChild(a);
    a.style.display = "none";
    return function (data, name) {
        var blob = new Blob(data, {type: "octet/stream"}),
            url = window.URL.createObjectURL(blob);
        a.href = url;
        a.download = name;
        a.click();
        window.URL.revokeObjectURL(url);
    };
}());

function importProfile() {
    console.log("Import profile");
    let input = document.createElement("input");
    input.type = "file";
    input.accept = ".leqium";

    input.onchange = (e) => {
        let file = e.target.files[0];
        parseProfileFile(file);
    }

    input.click();
}

function selectProfile(nickname) {
    console.log("Select Profile:", nickname);
    document.querySelector("#account-select .selected").innerHTML = (findByNickname(nickname)) ? document.getElementById(nickname + "-profile").innerHTML : `<div class="avatar"></div>Select Profile`;
    currentNickname = nickname;
    document.querySelector("#authorize").innerText = `Authorize${(findByNickname(nickname)) ? " as " + nickname : ""}`;
    window.localStorage.setItem("lastProfile", nickname);
}

function openAccountSelect() {
    document.querySelector("#account-select").classList.add("expanded");
    document.querySelectorAll("#account-select .dropdown button").forEach((elem) => elem.removeAttribute("disabled"));
}
function closeAccountSelect() {
    document.querySelector("#account-select").classList.remove("expanded");
    document.querySelectorAll("#account-select .dropdown button").forEach((elem) => elem.setAttribute("disabled", ""));
}
document.querySelector("#account-select .selected").addEventListener("click", openAccountSelect);
document.querySelector("#account-select").addEventListener("focusout", (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
        closeAccountSelect();
    }
});
document.querySelector("#create-profile").addEventListener("click", async () => {
    document.querySelector("#create-profile .loader").classList.remove("hidden");
    await createProfile(document.querySelector("#nickname").value, document.querySelector("#bio").value);
    document.querySelector("#create-profile .loader").classList.add("hidden");
})
document.querySelector("#authorize").addEventListener("click", async () => {
    let profile = findByNickname(currentNickname);
    let challengeBytes = new Uint8Array(host.length, challenge.length);
    for (var i = 0; i < host.length; i++) {
        challengeBytes[i] = host.charCodeAt(i);
    }
    for (var i = 0; i < challenge.length; i++) {
        challengeBytes[i + host.length] = challenge.charCodeAt(i);
    }
    let signature = await window.crypto.subtle.sign({name: "RSA-PSS", hash: "SHA-256", saltLength: 0}, profile.privateKey, challengeBytes);
    console.log(signature);
    const publicKeyBytes = new Uint8Array(await window.crypto.subtle.exportKey("spki", profile.publicKey));
    redirectPost(`https://${host}/auth/`, {signature: btoa(signature), publicKey: btoa(publicKeyBytes), nickname: profile.nickname, bio: profile.bio, avatar: btoa(profile.avatar)});
});

function redirectPost(url, data) {
    var form = document.createElement("form");
    document.body.appendChild(form);
    form.method = "post";
    form.action = url;
    for (var name in data) {
        var input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = data[name];
        form.appendChild(input);
    }
    form.submit();
}

function addAccountButtonsListeners() {
    document.querySelectorAll("#account-select .dropdown button").forEach((element) => {
        element.addEventListener("click", () => {
            closeAccountSelect();
            if (element.id != "import-profile" && element.id != "new-profile") {
                let nickname = element.id.slice(0, -8);
                selectProfile(nickname);
            }
            if (element.id == "import-profile") {
                document.querySelector("#account-select .selected").innerHTML = element.innerHTML;
                importProfile();
            }
            if (element.id == "new-profile") {
                document.querySelector("#account-select .selected").innerHTML = element.innerHTML;
                openCreateProfile();
            } else {
                closeCreateProfile();
            }
        });
    });
}
addAccountButtonsListeners();

let host, challenge;

function init() {
    let c = getParameter("c");
    if (!c) return;
    [host, challenge] = c.split("$");
    console.log(host);
    console.log(challenge);
    let hostText = document.querySelector("#host");
    hostText.innerText = host;
    hostText.insertAdjacentHTML("beforebegin", "<br>");
    loadProfiles();
}
init();