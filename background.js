chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "checkMercari",
        title: "🤖 AI相場アナリスト: \"%s\"",
        contexts: ["selection"]
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "checkMercari") {
        const query = encodeURIComponent(info.selectionText);
        const url = `https://jp.mercari.com/search?keyword=${query}&status=sold_out&sort=created_time&order=desc`;

        chrome.storage.local.set({ targetUrl: url }, () => {
            chrome.sidePanel.open({ tabId: tab.id }).catch((e) => console.error(e));
        });
    }
});