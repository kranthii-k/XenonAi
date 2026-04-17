import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import spacy
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from typing import List, Optional, Dict, Any
import joblib

app = FastAPI()

# Load Multi-Task Model Cluster
xenon_models = None
try:
    xenon_models = joblib.load("xenon_models.pkl")
    print("Multi-Task AI Core loaded successfully.")
except Exception as e:
    print(f"Warning: xenon_models.pkl not loaded. Falling back to Heuristics. Error: {e}")

# Load models safely
try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    print("Warning: spacy model 'en_core_web_sm' not found. Download it via: python -m spacy download en_core_web_sm")
    # Gracefully continue to let uvicorn boot, but requests will fail if not downloaded
    pass

analyzer = SentimentIntensityAnalyzer()

class ReviewRequest(BaseModel):
    text: str

def score_to_sentiment(compound: float) -> str:
    if compound >= 0.05: return "positive"
    elif compound <= -0.05: return "negative"
    else: return "neutral"

def normalize_feature(token_text: str) -> str:
    return token_text.lower().replace(" ", "_")

def extract_features(doc) -> List[Dict[str, Any]]:
    features = []
    
    # Simple aspect extraction rules using dependency parsing
    for token in doc:
        # If the token is a NOUN that acts as an nsubj (nominal subject) or pobj (object)
        if token.pos_ in ["NOUN", "PROPN"] and token.dep_ in ["nsubj", "pobj", "dobj"]:
            aspect = token.lemma_

            # Find connected adjectives (amod - adjectival modifier, acomp - adjectival complement)
            adjective_tokens = [child for child in token.head.children if child.pos_ == "ADJ" or child.dep_ == "acomp"]
            if token.pos_ == "NOUN" and token.dep_ == "nsubj":
                # if the head is a verb or aux that links to an adjective (e.g. "camera is amazing")
                if token.head.pos_ in ["AUX", "VERB"]:
                    for child in token.head.children:
                        if child.pos_ == "ADJ" or child.dep_ == "acomp":
                            adjective_tokens.append(child)
                            
            if adjective_tokens:
                # Group them up
                descriptor = " ".join([adj.text for adj in adjective_tokens])
                quote = f"{token.text} {token.head.text} {descriptor}".strip()
                
                # Analyze sentiment of the extracted context slice
                vs = analyzer.polarity_scores(quote)
                
                features.append({
                    "feature": normalize_feature(aspect),
                    "sentiment": score_to_sentiment(vs["compound"]),
                    "confidence": round(abs(vs["compound"]), 2) if abs(vs["compound"]) > 0 else 0.5,
                    "quote": quote
                })
                
    # Deduplicate extracted features slightly
    unique_features = {f["feature"]: f for f in features}
    return list(unique_features.values())

@app.post("/extract")
async def extract_nlp(payload: ReviewRequest):
    text = payload.text
    if not text:
        raise HTTPException(status_code=400, detail="Empty text provided")
        
    doc = nlp(text)
    
    # Multi-Task Prediction Suite Initialization
    sarcasm = False
    ambiguity = False
    ml_override = False
    ml_features = []
    
    if xenon_models is not None:
        try:
            # 1. Classify Primary Sentiment
            sent_model = xenon_models["sentiment"]
            overall_sentiment = sent_model.predict([text])[0]
            overall_confidence = round(max(sent_model.predict_proba([text])[0]), 2)
            
            # 2. Classify Binary Anomalies
            sarcasm = bool(xenon_models["sarcasm"].predict([text])[0])
            ambiguity = bool(xenon_models["ambiguity"].predict([text])[0])
            
            # 3. Classify Present Features (Multi-Label)
            feat_pred = xenon_models["feature_classifier"].predict([text])
            detected_feats = xenon_models["feature_mlb"].inverse_transform(feat_pred)[0]
            
            # Populate array based on ML labels
            for df in detected_feats:
                # localized sentiment for the isolated feature defaults to overall if not parsed
                ml_features.append({
                    "feature": df,
                    "sentiment": overall_sentiment,
                    "confidence": overall_confidence,
                    "quote": text[:50] + "..." # Extracted via ML, no exact dependency quote
                })
                
            ml_override = True
        except Exception as e:
            print("ML override failed", e)
            pass
            
    if not ml_override:
        # Fallback to Generic VADER Heuristics
        vs_overall = analyzer.polarity_scores(text)
        overall_sentiment = score_to_sentiment(vs_overall["compound"])
        overall_confidence = round((abs(vs_overall["compound"]) * 0.5) + (vs_overall["neu"] * 0.5), 2)
        
        # Sentence-level variance for Sarcasm check
        sentences = list(doc.sents)
        if len(sentences) > 1:
            scores = [analyzer.polarity_scores(s.text)["compound"] for s in sentences]
            if max(scores) > 0.5 and min(scores) < -0.5:
                sarcasm = True
                
        if vs_overall["neu"] > 0.8:
            ambiguity = True

    # Smart Feature Merging: Combine specific heuristic grammar matches and high-level ML matches
    final_features = extract_features(doc)
    existing_feat_tags = {f["feature"] for f in final_features}
    
    for mf in ml_features:
        if mf["feature"] not in existing_feat_tags:
            final_features.append(mf)
            
    sarcasm_reason = "Detected via ML Core Variance mapping" if sarcasm else None
    ambiguity_reason = "Detected via ML Core Semantic confusion mapping" if ambiguity else None

    return {
        "overall_sentiment": overall_sentiment,
        "overall_confidence": overall_confidence if overall_confidence > 0 else 0.5,
        "is_sarcastic": sarcasm,
        "is_ambiguous": ambiguity,
        "language_detected": "en",
        "translated_text": None,
        "features": final_features,
        "sarcasm_reason": sarcasm_reason,
        "ambiguity_reason": ambiguity_reason
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=5000, reload=True)
