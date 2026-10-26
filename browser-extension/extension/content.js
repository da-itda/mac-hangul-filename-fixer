// 한글본드 브라우저 확장
// 맥의 Chromium 계열 브라우저는 업로드 파일명을 NFD(자소 분리)로 넘긴다.
// 페이지가 파일을 읽기 전에 이름만 NFC로 바꾼다. 이름이 바뀌어야 할 때만 개입하고,
// 파일 내용은 그대로 두며 네트워크·저장소를 사용하지 않는다.
(() => {
  const isNfc = (name) => name === name.normalize("NFC");
  const needsFix = (files) => Array.from(files).some((file) => !isNfc(file.name));

  const toNfcFile = (file) =>
    isNfc(file.name)
      ? file
      : new File([file], file.name.normalize("NFC"), {
          type: file.type,
          lastModified: file.lastModified
        });

  const toNfcFileList = (files) => {
    const transfer = new DataTransfer();
    for (const file of files) {
      transfer.items.add(toNfcFile(file));
    }
    return transfer.files;
  };

  // 드롭·붙여넣기에 함께 담긴 텍스트 데이터(링크, HTML 등)도 그대로 옮긴다.
  const toNfcTransfer = (data) => {
    const transfer = new DataTransfer();
    for (const type of data.types) {
      if (type !== "Files") {
        transfer.setData(type, data.getData(type));
      }
    }
    for (const file of data.files) {
      transfer.items.add(toNfcFile(file));
    }
    return transfer;
  };

  // 폴더 업로드는 다시 만든 File에서 폴더 경로(webkitRelativePath)가 사라지므로 건드리지 않는다.
  const isFolderInput = (input) =>
    input.webkitdirectory || Array.from(input.files).some((file) => file.webkitRelativePath);

  const hasDirectory = (data) =>
    Array.from(data.items || []).some(
      (item) => item.kind === "file" && item.webkitGetAsEntry?.()?.isDirectory
    );

  // Shadow DOM 안의 요소도 처리하려고 실제 대상(composedPath의 첫 요소)을 사용한다.
  const realTarget = (event) => event.composedPath()[0] || event.target;

  // 브라우저는 input → change 순서로 이벤트를 보낸다. 먼저 오는 쪽에서 바꾸고,
  // 캡처 단계에서 처리해 페이지 스크립트와 일반 폼 제출이 모두 NFC 이름을 보게 한다.
  const fixFileInput = (event) => {
    const input = realTarget(event);
    if (!(input instanceof HTMLInputElement) || input.type !== "file") {
      return;
    }
    if (!input.files?.length || isFolderInput(input) || !needsFix(input.files)) {
      return;
    }
    input.files = toNfcFileList(input.files);
  };

  window.addEventListener("input", fixFileInput, true);
  window.addEventListener("change", fixFileInput, true);

  const pointerInit = (event) => ({
    clientX: event.clientX,
    clientY: event.clientY,
    screenX: event.screenX,
    screenY: event.screenY,
    ctrlKey: event.ctrlKey,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    metaKey: event.metaKey,
    button: event.button,
    buttons: event.buttons
  });

  // DataTransfer의 파일 목록은 바꿀 수 없으므로, 원래 이벤트를 멈추고
  // NFC 파일을 담은 같은 종류의 이벤트를 같은 대상에 다시 보낸다.
  const redispatch = (event, init) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    realTarget(event).dispatchEvent(
      new event.constructor(event.type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        ...init
      })
    );
  };

  window.addEventListener(
    "drop",
    (event) => {
      const data = event.dataTransfer;
      if (!event.isTrusted || !data?.files.length || hasDirectory(data) || !needsFix(data.files)) {
        return;
      }
      redispatch(event, { ...pointerInit(event), dataTransfer: toNfcTransfer(data) });
    },
    true
  );

  window.addEventListener(
    "paste",
    (event) => {
      const data = event.clipboardData;
      if (!event.isTrusted || !data?.files.length || !needsFix(data.files)) {
        return;
      }
      redispatch(event, { clipboardData: toNfcTransfer(data) });
    },
    true
  );
})();
