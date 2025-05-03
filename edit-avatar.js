let canvas = document.querySelector("#edit-avatar canvas");
let ctx = canvas.getContext("2d");
let avatarImg;
let offsetX = 0;
let offsetY = 0;
let avatarZoom = 1;
function startEditAvatar(imgUrl) {
    document.querySelector("#edit-avatar").classList.remove("hidden");
    avatarImg = new Image();
    avatarImg.src = imgUrl;
    canvas = document.querySelector("#edit-avatar canvas");
    ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    avatarImg.onload = () => {
        offsetX = 0;
        offsetY = 0;
        if (avatarImg.width > avatarImg.height) {
            avatarZoom = canvas.height / avatarImg.height;
            offsetX = (avatarImg.width * avatarZoom - canvas.width) / -2;
        } else {
            avatarZoom = canvas.width / avatarImg.width;
            offsetY = (avatarImg.height * avatarZoom - canvas.height) / -2;
        }
        updateCanvas();
    }
}

function updateCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(avatarImg, offsetX, offsetY, avatarImg.width * avatarZoom, avatarImg.height * avatarZoom);
}

canvas.addEventListener("wheel", async function (e) {
    if (e.wheelDelta < 0) {
        avatarZoom -= 0.02;
        offsetX += avatarImg.width * 0.02 / 2;
        offsetY += avatarImg.height * 0.02 / 2;
    } else {
        avatarZoom += 0.02;
        offsetX -= avatarImg.width * 0.02 / 2;
        offsetY -= avatarImg.height * 0.02 / 2;
    }
    updateCanvas();
});
canvas.addEventListener("mousemove", async function (e) {
    if (e.buttons == 0) return;
    let ratio = canvas.width / canvas.clientWidth;
    offsetX += e.movementX * ratio;
    offsetY += e.movementY * ratio;
    updateCanvas();
});
let editedAvatar;
function confirmAvatar() {
    var newCanvas = document.createElement("canvas");
    newCanvas.width = 128;
    newCanvas.height = 128;
    newCanvas.getContext("2d").drawImage(canvas, -64, -64, 256, 256);
    editedAvatar = undefined;
    newCanvas.toBlob(async (blob) => {
        editedAvatar = new Uint8Array(await blob.arrayBuffer());
    }, "image/png");
    document.querySelector("#edit-avatar").classList.add("hidden");
}

const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
});

document.querySelector("#avatar").addEventListener("change", async function (e) {
    if (this.files.length == 0) return;
    startEditAvatar(await toBase64(this.files[0]));
});
document.querySelector("#avatar-edit").addEventListener("change", async function (e) {
    if (this.files.length == 0) return;
    startEditAvatar(await toBase64(this.files[0]));
});
document.querySelector("#edit-avatar .cancel").addEventListener("click", () => {
    document.querySelector("#avatar").value = "";
    editedAvatar = undefined;
    document.querySelector("#edit-avatar").classList.add("hidden");
});
document.querySelector("#edit-avatar .confirm").addEventListener("click", confirmAvatar);