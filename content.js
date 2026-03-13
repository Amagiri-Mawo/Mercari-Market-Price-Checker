function scrapePrices() {
    const prices = [];

    // 網1: メルカリ特有の価格表示タグを直接狙う
    const selectors = [
        'span[class*="price"]',
        'div[class*="price"]',
        'p[class*="price"]',
        '[data-testid="thumbnail-item-price"]' // 2026年最新の重要タグ
    ];

    document.querySelectorAll(selectors.join(',')).forEach(el => {
        // ￥マークが含まれているテキストから数字だけを抽出
        const val = el.innerText.replace(/[^0-9]/g, '');
        if (val && val.length >= 3) { // 300円以上の現実的な価格
            prices.push(parseInt(val));
        }
    });

    // 網2: もし網1で見つからなければ、画面上の全テキストから「￥」を探す
    if (prices.length === 0) {
        const all = document.body.innerText.match(/￥\s?([\d,]+)/g);
        if (all) {
            all.forEach(s => {
                const p = parseInt(s.replace(/[^0-9]/g, ''));
                if (p >= 300 && p < 1000000) prices.push(p);
            });
        }
    }

    const uniquePrices = [...new Set(prices)];

    if (uniquePrices.length > 0) {
        console.log("🔥 スパイが価格を検知しました！:", uniquePrices);
        chrome.runtime.sendMessage({ type: "PRICES_FOUND", prices: uniquePrices });
    } else {
        console.log("👀 巡回中: まだ価格が見つかりません。画面を少し下にスクロールしてください。");
    }
}

// 0.8秒ごとに何度もチェックする（メルカリの読み込みに合わせて）
setInterval(scrapePrices, 800);