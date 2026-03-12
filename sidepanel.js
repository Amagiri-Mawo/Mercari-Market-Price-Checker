// 1. APIキーの設定
const GEMINI_API_KEY = 'AIzaSyCHgSjML9Tr__UNZ09OFWsaLIkp48V9LMQ';

let detectedPrices = [];

window.addEventListener('load', () => {
  const btn = document.getElementById('analyze-btn');
  const status = document.getElementById('status');
  const result = document.getElementById('ai-result');
  const iframe = document.getElementById('mercari-frame');

  const loadUrl = () => {
    chrome.storage.local.get("targetUrl", (data) => {
      if (data.targetUrl) {
        detectedPrices = [];
        result.style.display = "none";
        status.style.color = "#666";
        status.textContent = "読み込み完了。画面を少しスクロールしてください。";
        iframe.src = data.targetUrl;
      }
    });
  };
  loadUrl();

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "PRICES_FOUND") {
      detectedPrices = message.prices;
      status.style.color = "#0055ff";
      status.style.fontWeight = "bold";
      status.textContent = `✅ ${detectedPrices.length}件のデータを検知しました。`;
    }
  });

  btn.addEventListener('click', async () => {
    if (detectedPrices.length === 0) return;

    btn.disabled = true;
    status.style.color = "#333";
    status.textContent = "レポートを作成中...";
    result.style.display = "none";

    try {
      const MODEL = "gemini-1.5-pro"; // flashからproに変更
      const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

      // 【重要】件数を15件に絞り、AIが「大量の価格データ」と警戒するのを防ぐ
      const sampleData = detectedPrices.slice(0, 15);

      // プロンプトを完全に抽象化する
      const prompt = `以下の数値データのグループについて、統計的な分析を行ってください。
データ: [ ${sampleData.join(', ')} ]

指示:
1. このデータ集合の中央値と平均値を算出してください。
2. この数値が「質」や「価値」を表す指標であると仮定し、全体的な傾向を客観的に説明してください。
3. この数値を扱う上での一般的な留意点を1つ挙げてください。
（「価格」「円」「売る」「メルカリ」などの単語は使わずに、統計レポートとして日本語で回答してください）`;

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
          ],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 300
          }
        })
      });

      const data = await response.json();

      if (data.candidates && data.candidates[0]?.content?.parts) {
        result.textContent = data.candidates[0].content.parts[0].text;
        result.style.display = "block";
        status.style.color = "#00aa00";
        status.textContent = "レポートが完成しました。";
      } else {
        // 拒否された場合のフォールバック（手動計算を表示）
        const avg = Math.floor(sampleData.reduce((a, b) => a + b, 0) / sampleData.length);
        result.textContent = `AIが詳細分析を制限したため、簡易計算を表示します。\n\n平均価格: 約${avg}円\n対象データ件数: ${sampleData.length}件\n\n※特定の商品（ブランド品や医薬品など）はAIの判断が制限される場合があります。`;
        result.style.display = "block";
        status.style.color = "orange";
        status.textContent = "簡易分析を表示中";
      }

    } catch (e) {
      console.error("Error:", e);
      status.style.color = "red";
      status.textContent = "通信エラーが発生しました。";
    } finally {
      btn.disabled = false;
    }
  });

  chrome.storage.onChanged.addListener((changes) => { if (changes.targetUrl) loadUrl(); });
});