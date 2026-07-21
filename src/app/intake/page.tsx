"use client";

import Link from "next/link";
import { useState } from "react";

type Item = {
  id: string;
  label: string;
  parentId: string | null;
  confidence: number;
  status: "confirmed" | "review";
};

const initialItems: Item[] = [
  { id: "bag", label: "Black backpack", parentId: null, confidence: 0.98, status: "confirmed" },
  { id: "pouch", label: "Brown coin pouch", parentId: "bag", confidence: 0.96, status: "confirmed" },
  { id: "sgd", label: "Singapore currency", parentId: "pouch", confidence: 0.94, status: "confirmed" },
  { id: "myr", label: "Possible Malaysian currency", parentId: "pouch", confidence: 0.63, status: "review" },
  { id: "cable", label: "USB-C charging cable", parentId: "bag", confidence: 0.91, status: "confirmed" },
  { id: "cardholder", label: "Cardholder", parentId: "bag", confidence: 0.89, status: "confirmed" },
];

export default function IntakeDemo() {
  const [items, setItems] = useState(initialItems);
  const [finalised, setFinalised] = useState(false);

  const unresolved = items.filter((item) => item.status === "review").length;

  function confirmItem(id: string) {
    setItems((current) => current.map((item) =>
      item.id === id ? { ...item, label: "Malaysian currency", status: "confirmed" } : item
    ));
  }

  return (
    <main className="demo-page">
      <header className="demo-header shell">
        <div>
          <Link className="brand" href="/">FoundFlow</Link>
          <p>Guided intake · Case FF-0241</p>
        </div>
        <span className={finalised ? "status status-complete" : "status"}>
          {finalised ? "Finalised" : `${unresolved} item requires review`}
        </span>
      </header>

      <div className="shell demo-layout">
        <section className="capture-panel">
          <p className="eyebrow">Evidence set</p>
          <h1>Complex bag intake</h1>
          <p className="muted">This deterministic case demonstrates the review workflow without sending personal property to a live AI provider.</p>
          <div className="evidence-placeholder evidence-main">
            <span>01</span>
            <strong>Outer property</strong>
            <small>Black backpack · overview captured</small>
          </div>
          <div className="evidence-row">
            <div className="evidence-placeholder">
              <span>02</span>
              <strong>Bag contents</strong>
            </div>
            <div className="evidence-placeholder">
              <span>03</span>
              <strong>Coin pouch</strong>
            </div>
          </div>
          <button className="button button-secondary full-width" type="button">Add another evidence photo</button>
        </section>

        <section className="review-panel">
          <div className="review-heading">
            <div>
              <p className="eyebrow">AI-generated draft</p>
              <h2>Review the manifest</h2>
            </div>
            <span>{items.length} entries</span>
          </div>

          <div className="item-list">
            {items.map((item) => (
              <article className={`review-item depth-${item.parentId === null ? 0 : item.parentId === "pouch" ? 2 : 1}`} key={item.id}>
                <div>
                  <strong>{item.label}</strong>
                  <p>Confidence {Math.round(item.confidence * 100)}% · Evidence linked</p>
                </div>
                {item.status === "review" ? (
                  <button className="review-button" onClick={() => confirmItem(item.id)} type="button">Confirm as MYR</button>
                ) : (
                  <span className="verified">Confirmed</span>
                )}
              </article>
            ))}
          </div>

          <div className="finalise-row">
            <p>{unresolved === 0 ? "All entries have been reviewed." : "Resolve uncertain entries before finalising."}</p>
            <button
              className="button"
              disabled={unresolved > 0 || finalised}
              onClick={() => setFinalised(true)}
              type="button"
            >
              {finalised ? "Manifest finalised" : "Approve manifest"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
