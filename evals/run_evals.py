#!/usr/bin/env python3
"""골든셋으로 입금 대조 엔진(src/core.mjs)의 품질을 측정한다.

정확도/정밀도/재현율 + 실패 유형별 집계를 출력한다.
외부 의존성 없음(표준 라이브러리 + node). 엔진 호출은 bridge.mjs로 격리.

사용법:  python3 evals/run_evals.py
"""
import collections
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent
GOLDEN = HERE / "golden.jsonl"
BRIDGE = HERE / "bridge.mjs"


def load_cases():
    cases = []
    for i, line in enumerate(GOLDEN.read_text(encoding="utf-8").splitlines(), 1):
        line = line.strip()
        if not line:
            continue
        try:
            cases.append(json.loads(line))
        except json.JSONDecodeError as exc:
            sys.exit(f"golden.jsonl {i}행 파싱 실패: {exc}")
    return cases


def run_engine():
    proc = subprocess.run(
        ["node", str(BRIDGE), str(GOLDEN)],
        capture_output=True, text=True,
    )
    if proc.returncode != 0:
        sys.exit(f"엔진 실행 실패:\n{proc.stderr}")
    return {row["id"]: row["predicted"] for row in json.loads(proc.stdout)}


def main():
    cases = load_cases()
    pred = run_engine()

    tp = fp = fn = tn = 0
    per_cat = collections.defaultdict(lambda: {"n": 0, "pass": 0, "fail_ids": []})

    for c in cases:
        gold = c["expected"]["match"]
        got = pred.get(c["id"])
        cat = per_cat[c["category"]]
        cat["n"] += 1
        if got == gold:
            cat["pass"] += 1
        else:
            cat["fail_ids"].append(c["id"])

        if gold is not None and got == gold:
            tp += 1
        elif gold is None and got is None:
            tn += 1
        else:
            # 예측이 정답과 다름
            if got is not None:          # 뭔가에 매칭했는데 틀림 -> 오탐
                fp += 1
            if gold is not None:         # 매칭했어야 할 결제를 놓침 -> 미탐
                fn += 1

    total = len(cases)
    correct = tp + tn
    acc = correct / total if total else 0.0
    prec = tp / (tp + fp) if (tp + fp) else 0.0
    rec = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = 2 * prec * rec / (prec + rec) if (prec + rec) else 0.0

    print(f"= 입금 대조 엔진 평가 =  ({total} 케이스, 엔진: src/core.mjs reconcile)\n")
    print(f"  정확도 accuracy   {acc:7.1%}   ({correct}/{total} 케이스 예측 일치)")
    print(f"  정밀도 precision  {prec:7.1%}   (TP {tp} / 매칭제안 {tp + fp})")
    print(f"  재현율 recall     {rec:7.1%}   (TP {tp} / 정답매칭 {tp + fn})")
    print(f"  F1               {f1:7.1%}")
    print(f"  혼동행렬  TP={tp}  FP={fp}  FN={fn}  TN={tn}\n")

    print("  실패 유형별 집계")
    print(f"    {'category':<30}{'n':>4}{'pass':>6}{'fail':>6}   실패 케이스")
    print(f"    {'-' * 30}{'-' * 4}{'-' * 6}{'-' * 6}   {'-' * 20}")
    for name in sorted(per_cat):
        s = per_cat[name]
        ids = ", ".join(s["fail_ids"]) or "-"
        print(f"    {name:<30}{s['n']:>4}{s['pass']:>6}{s['n'] - s['pass']:>6}   {ids}")


if __name__ == "__main__":
    main()
