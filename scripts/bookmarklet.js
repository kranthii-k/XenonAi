/* 
  Xenon Intelligence: Reviews Bookmarklet
  Usage: While on Amazon/Flipkart review page, paste this into the Console (F12) 
*/
(function() {
    console.log("[Xenon] Starting extraction...");
    let reviews = [];
    const isAmazon = window.location.hostname.includes("amazon");
    const isFlipkart = window.location.hostname.includes("flipkart");

    if (isAmazon) {
        document.querySelectorAll("div[data-hook='review']").forEach(container => {
            const text = container.querySelector("span[data-hook='review-body']")?.innerText.trim();
            const ratingText = container.querySelector("i[data-hook='review-star-rating'] span")?.innerText;
            const rating = ratingText ? parseInt(ratingText[0]) : 5;
            if (text) reviews.push({ text, rating, created_at: new Date().toISOString() });
        });
    } else if (isFlipkart) {
        document.querySelectorAll("div._27M-N1, div._1AtVbE").forEach(container => {
            const textElem = container.querySelector("div.t-ZTKy");
            if (!textElem) return;
            const text = textElem.innerText.replace("READ MORE", "").trim();
            const rating = parseInt(container.querySelector("div._3LWZlK")?.innerText || "5");
            if (text) reviews.push({ text, rating, created_at: new Date().toISOString() });
        });
    }

    if (reviews.length > 0) {
        const payload = JSON.stringify({ reviews }, null, 2);
        copy(payload);
        alert(`🚀 [Xenon] Successfully extracted ${reviews.length} reviews!\n\nJSON has been copied to your clipboard.\n\nGo to the Xenon Dashboard and paste it into the 'Paste Text' mode.`);
        console.log("[Xenon] Data copied to clipboard:", reviews);
    } else {
        alert("❌ [Xenon] No reviews found. Ensure you are on the 'All Reviews' page.");
    }
})();
