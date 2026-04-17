console.log("[Xenon Sidecar] Active");

function injectAnalyzeButton() {
    if (document.getElementById("xenon-analyze-btn")) return;

    const isAmazon = window.location.hostname.includes("amazon");
    const isFlipkart = window.location.hostname.includes("flipkart");

    const btn = document.createElement("button");
    btn.id = "xenon-analyze-btn";
    btn.innerHTML = `
        <span style="margin-right: 8px;">🚀</span>
        Analyze with Xenon
    `;
    btn.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 99999;
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 50px;
        font-family: 'Inter', system-ui, sans-serif;
        font-weight: 600;
        font-size: 14px;
        cursor: pointer;
        box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.4);
        display: flex;
        align-items: center;
        transition: all 0.2s ease;
    `;

    btn.onmouseover = () => {
        btn.style.transform = "translateY(-2px) scale(1.05)";
        btn.style.boxShadow = "0 15px 30px -5px rgba(37, 99, 235, 0.5)";
    };
    btn.onmouseout = () => {
        btn.style.transform = "translateY(0) scale(1)";
        btn.style.boxShadow = "0 10px 25px -5px rgba(37, 99, 235, 0.4)";
    };

    btn.onclick = async () => {
        btn.disabled = true;
        btn.innerHTML = `<span>⏳</span> Analyzing...`;
        
        let reviews = [];
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
            try {
                // Determine Product ID from URL
                const productId = window.location.pathname.split('/')[2] || 'detected-product';

                // DIRECT PUSH TO BACKEND (Zero-Copy)
                const response = await fetch('http://localhost:3000/api/ingest/sidecar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        reviews, 
                        productId,
                        url: window.location.href 
                    }),
                });

                if (response.ok) {
                    btn.style.background = "#10b981";
                    btn.innerHTML = `<span>✅</span> Data Ingested!`;
                    
                    setTimeout(() => {
                        if (confirm(`🚀 [Xenon] Successfully ingested ${reviews.length} reviews!\n\nWould you like to open your Dashboard to see the results?`)) {
                            window.open("http://localhost:3000/dashboard", "_blank");
                        }
                        btn.disabled = false;
                        btn.innerHTML = `<span>🚀</span> Analyze with Xenon`;
                        btn.style.background = "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)";
                    }, 500);
                } else {
                    throw new Error("API Bridge failed");
                }
            } catch (err) {
                console.error("[Xenon Sidecar] Direct push failed:", err);
                
                // Fallback to Clipboard if Backend is down
                const payload = JSON.stringify({ reviews }, null, 2);
                const el = document.createElement('textarea');
                el.value = payload;
                document.body.appendChild(el);
                el.select();
                document.execCommand('copy');
                document.body.removeChild(el);
                
                btn.style.background = "#f59e0b";
                btn.innerHTML = `<span>⚠️</span> Clipboard Fallback`;
                alert("⚠️ Xenon Backend unreachable. Data has been copied to your clipboard instead.\n\nPlease paste it into the 'Paste Text' section of the dashboard.");
                
                setTimeout(() => {
                    btn.disabled = false;
                    btn.innerHTML = `<span>🚀</span> Analyze with Xenon`;
                    btn.style.background = "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)";
                }, 2000);
            }
        } else {
            alert("❌ No reviews found. Ensure you are on the 'All Reviews' page.");
            btn.disabled = false;
            btn.innerHTML = `<span>🚀</span> Analyze with Xenon`;
        }
    };

    document.body.appendChild(btn);
}

// Run on load and after short delay for SPAs
injectAnalyzeButton();
setTimeout(injectAnalyzeButton, 2000);
window.addEventListener('load', injectAnalyzeButton);
