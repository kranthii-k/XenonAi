import json
import random
import itertools

def generate():
    features = [
        "camera", "battery_life", "display", "performance", 
        "software", "customer_support", "price", "build_quality"
    ]
    
    pos_adjs = ["amazing", "fantastic", "stunning", "incredible", "revolutionary", "flawless", "excellent", "superb"]
    neg_adjs = ["terrible", "awful", "garbage", "trash", "horrible", "abysmal", "clunky", "slow"]
    neu_adjs = ["okay", "average", "decent", "mediocre", "passable", "fine", "standard", "acceptable"]
    
    dataset = []

    # 1. Straight Sentiments
    for f in features:
        for adj in pos_adjs:
            dataset.append({
                "text": f"The {f.replace('_', ' ')} is {adj}. Really happy.",
                "sentiment": "positive", "sarcastic": False, "ambiguous": False,
                "features": {f: "positive"}
            })
            dataset.append({
                "text": f"I absolutely love the {adj} {f.replace('_', ' ')}.",
                "sentiment": "positive", "sarcastic": False, "ambiguous": False,
                "features": {f: "positive"}
            })
        for adj in neg_adjs:
            dataset.append({
                "text": f"The {f.replace('_', ' ')} is {adj}. Disappointed.",
                "sentiment": "negative", "sarcastic": False, "ambiguous": False,
                "features": {f: "negative"}
            })
            dataset.append({
                "text": f"Worst {f.replace('_', ' ')} ever. It feels {adj}.",
                "sentiment": "negative", "sarcastic": False, "ambiguous": False,
                "features": {f: "negative"}
            })
        for adj in neu_adjs:
            dataset.append({
                "text": f"The {f.replace('_', ' ')} is just {adj}. Nothing special.",
                "sentiment": "neutral", "sarcastic": False, "ambiguous": False,
                "features": {}
            })

    # 2. Sarcasm (Praising a flaw or extreme variance)
    for f in features:
        for p_adj in pos_adjs:
            for n_adj in neg_adjs:
                dataset.append({
                    "text": f"Oh wow, the {p_adj} {f.replace('_', ' ')} died in 2 minutes. Revolutionary {n_adj} technology.",
                    "sentiment": "negative", "sarcastic": True, "ambiguous": False,
                    "features": {f: "negative"}
                })
                dataset.append({
                    "text": f"10/10 would definitely not recommend this {n_adj} {f.replace('_', ' ')}.",
                    "sentiment": "negative", "sarcastic": True, "ambiguous": False,
                    "features": {f: "negative"}
                })
                dataset.append({
                    "text": f"What a {p_adj} piece of {n_adj} garbage. The {f.replace('_', ' ')} is a joke.",
                    "sentiment": "negative", "sarcastic": True, "ambiguous": False,
                    "features": {f: "negative"}
                })

    # 3. Ambiguous (Conflicting literals without sarcasm)
    for f in features:
        for p_adj in pos_adjs:
            for n_adj in neg_adjs:
                dataset.append({
                    "text": f"On one hand the {f.replace('_', ' ')} is {p_adj}, but on the other hand it is {n_adj}.",
                    "sentiment": "neutral", "sarcastic": False, "ambiguous": True,
                    "features": {f: "neutral"}
                })
                dataset.append({
                    "text": f"The {f.replace('_', ' ')} is {neu_adjs[0]}, but sometimes it acts {n_adj}. Still, it looks {p_adj}.",
                    "sentiment": "neutral", "sarcastic": False, "ambiguous": True,
                    "features": {f: "neutral"}
                })
                
    # 4. Multi-Feature Complex
    combinations = list(itertools.combinations(features, 2))
    for f1, f2 in random.sample(combinations, 20):
        for p_adj in pos_adjs[:4]:
            for n_adj in neg_adjs[:4]:
                dataset.append({
                    "text": f"The {f1.replace('_', ' ')} is {p_adj}, but sadly the {f2.replace('_', ' ')} is {n_adj}.",
                    "sentiment": "negative", "sarcastic": False, "ambiguous": False,
                    "features": {f1: "positive", f2: "negative"}
                })
                dataset.append({
                    "text": f"While the {f1.replace('_', ' ')} is {n_adj}, I must say the {f2.replace('_', ' ')} is {p_adj}.",
                    "sentiment": "positive", "sarcastic": False, "ambiguous": False,
                    "features": {f1: "negative", f2: "positive"}
                })

    random.shuffle(dataset)
    print(f"Synthesized {len(dataset)} exhaustive training permutations.")
    
    with open("training_data.json", "w", encoding="utf-8") as file:
        json.dump(dataset, file, indent=2)

if __name__ == "__main__":
    generate()
