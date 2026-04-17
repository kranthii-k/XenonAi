import asyncio
from undetected_playwright.async_api import async_playwright
from bs4 import BeautifulSoup
import json
import argparse
import sys
import re
from datetime import datetime

from playwright_stealth import Stealth

class PlaywrightScraper:
    def __init__(self):
        self.user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

    async def fetch_page(self, url):
        async with async_playwright() as p:
            # Slow down execution to look more human
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent=self.user_agent,
                viewport={'width': 1920, 'height': 1080}
            )
            page = await context.new_page()
            
            # Apply stealth
            await Stealth().apply_stealth_async(page)
            
            print(f"[*] Navigating to: {url}", file=sys.stderr)
            try:
                # Use a real referer
                await page.goto(url, wait_until="domcontentloaded", timeout=60000)
                
                # Human-like interaction: scroll a bit
                await page.mouse.wheel(0, 500)
                await asyncio.sleep(2)
                
                content = await page.content()
                await browser.close()
                return content
            except Exception as e:
                print(f"[!] Browser error: {e}", file=sys.stderr)
                await browser.close()
                return None

    def parse_amazon(self, html):
        soup = BeautifulSoup(html, "html.parser")
        reviews = []
        for container in soup.select("div[data-hook='review']"):
            try:
                rating_text = container.select_one("i[data-hook='review-star-rating'] span, span.a-icon-alt")
                rating = 5
                if rating_text:
                    match = re.search(r"(\d)", rating_text.get_text())
                    if match: rating = int(match.group(1))
                
                text_elem = container.select_one("span[data-hook='review-body']")
                text = text_elem.get_text().strip() if text_elem else ""
                
                date_elem = container.select_one("span[data-hook='review-date']")
                date_str = date_elem.get_text().strip() if date_elem else ""
                
                if text:
                    reviews.append({
                        "text": text,
                        "rating": rating,
                        "date_raw": date_str,
                        "created_at": datetime.now().isoformat()
                    })
            except Exception:
                continue
        return reviews

    def parse_flipkart(self, html):
        soup = BeautifulSoup(html, "html.parser")
        reviews = []
        # Flipkart review containers often have these classes
        for container in soup.select("div.col._2wY_9u, div._27M-N1, div._1AtVbE"):
            try:
                text_elem = container.select_one("div.t-ZTKy")
                if not text_elem: continue
                
                text = text_elem.get_text().replace("READ MORE", "").strip()
                
                rating_elem = container.select_one("div._3LWZlK")
                rating = int(rating_elem.get_text().strip()) if rating_elem else 5
                
                date_elem = container.select_one("p._2sc7qz")
                date_str = date_elem.get_text().strip() if date_elem else ""
                
                if text:
                    reviews.append({
                        "text": text,
                        "rating": rating,
                        "date_raw": date_str,
                        "created_at": datetime.now().isoformat()
                    })
            except Exception:
                continue
        return reviews

async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True)
    args = parser.parse_args()
    
    scraper = PlaywrightScraper()
    
    # URL Normalization
    url = args.url
    if "amazon.in" in url and "/dp/" in url and "product-reviews" not in url:
        url = url.replace("/dp/", "/product-reviews/")
    
    html = await scraper.fetch_page(url)
    if not html:
        print(json.dumps({"error": "Failed to fetch page content"}))
        return

    if "amazon" in url:
        results = scraper.parse_amazon(html)
    elif "flipkart" in url:
        results = scraper.parse_flipkart(html)
    else:
        results = {"error": "Unsupported provider"}
    
    if not results:
        # Check for bot detection markers in HTML
        if "captcha" in html.lower() or "robot" in html.lower():
            results = {"error": "Bot detection triggered (CAPTCHA)"}
        else:
            results = {"error": "No reviews found on page"}
            
    print(json.dumps(results, indent=2))

if __name__ == "__main__":
    asyncio.run(main())
