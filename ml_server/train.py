import json
import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.svm import LinearSVC
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import MultiLabelBinarizer
from sklearn.multiclass import OneVsRestClassifier
import time

def train_multitask_models():
    print("Loading expansive synthetic training memory...")
    try:
        with open("training_data.json", "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        print("training_data.json not found! Cannot train models.")
        return

    X = [item["text"] for item in data]
    
    # Extract independent matrices
    y_sentiment = [item["sentiment"] for item in data]
    y_sarcasm = [1 if item["sarcastic"] else 0 for item in data]
    y_ambiguity = [1 if item["ambiguous"] else 0 for item in data]

    # For features, we just train a multi-label classification of WHICH features are present in the text
    # e.g., ["camera", "battery_life"]
    # We leave the feature-specific sentiment fallback to local contextual polarities
    y_features_raw = [list(item["features"].keys()) for item in data]
    
    # Binarize the Multi-Label array
    mlb = MultiLabelBinarizer()
    y_features = mlb.fit_transform(y_features_raw)

    print(f"Loaded {len(X)} records. Initializing Multi-Task Machine Learning Suite...")

    # 1. Sentiment Pipeline
    print("Training Sentiment Optimizer (Logistic Regression)...")
    pipe_sent = Pipeline([
        ('tfidf', TfidfVectorizer(max_features=4000, ngram_range=(1, 3))),
        ('clf', LogisticRegression(max_iter=300))
    ])
    pipe_sent.fit(X, y_sentiment)

    # 2. Sarcasm Pipeline
    print("Training Sarcasm Vector (LinearSVC)...")
    pipe_sarcasm = Pipeline([
        ('tfidf', TfidfVectorizer(max_features=4000, ngram_range=(1, 3))),
        ('clf', LogisticRegression(max_iter=300))
    ])
    pipe_sarcasm.fit(X, y_sarcasm)

    # 3. Ambiguity Pipeline
    print("Training Ambiguity Vector (LinearSVC)...")
    pipe_ambig = Pipeline([
        ('tfidf', TfidfVectorizer(max_features=4000, ngram_range=(1, 3))),
        ('clf', LogisticRegression(max_iter=300))
    ])
    pipe_ambig.fit(X, y_ambiguity)

    # 4. Feature Extraction Pipeline (Multi-Label OneVsRest)
    print("Training Feature Extractor (OneVsRest LinearSVC)...")
    pipe_feat = Pipeline([
        ('tfidf', TfidfVectorizer(max_features=4000)),
        ('clf', OneVsRestClassifier(LinearSVC(dual="auto")))
    ])
    pipe_feat.fit(X, y_features)

    # Export multi-model memory dictionary
    models_package = {
        "sentiment": pipe_sent,
        "sarcasm": pipe_sarcasm,
        "ambiguity": pipe_ambig,
        "feature_classifier": pipe_feat,
        "feature_mlb": mlb
    }

    print("Compiling network cluster into static .pkl payload...")
    joblib.dump(models_package, "xenon_models.pkl")
    print(f"Successfully exported comprehensive 'xenon_models.pkl' containing 4 discrete AI models!")

if __name__ == "__main__":
    start = time.time()
    train_multitask_models()
    print(f"Total training time: {round(time.time() - start, 2)}s")
