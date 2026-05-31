import React, { useMemo, useState } from 'react';
import styles from './App.module.css';

const API_URL = 'http://localhost:8000/api/review';
const SUPPORTED_EXTENSIONS = [
  '.py',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.java',
  '.c',
  '.cpp',
  '.go',
  '.rs',
  '.php',
];

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) {
    return '0 B';
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function ScoreTable({ scores }) {
  if (!scores) {
    return null;
  }

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Category</th>
          <th>Score</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(scores).map(([category, score]) => (
          <tr key={category}>
            <td>{category.replaceAll('_', ' ')}</td>
            <td>{score}/10</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Issues({ issues }) {
  if (!issues?.length) {
    return <p className={styles.empty}>No specific issues returned.</p>;
  }

  return (
    <div className={styles.issueList}>
      {issues.map((issue, index) => (
        <article className={styles.issue} key={`${issue.category}-${index}`}>
          <div className={styles.issueMeta}>
            <span>{issue.severity}</span>
            <span>{issue.category}</span>
            {issue.line ? <span>Line {issue.line}</span> : null}
          </div>
          <p>{issue.problem}</p>
          <p className={styles.recommendation}>{issue.recommendation}</p>
        </article>
      ))}
    </div>
  );
}

function TextList({ items, emptyText }) {
  if (!items?.length) {
    return <p className={styles.empty}>{emptyText}</p>;
  }

  return (
    <ul className={styles.list}>
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  );
}

function parseJsonText(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function JsonValue({ value }) {
  if (Array.isArray(value)) {
    if (!value.length) {
      return <span className={styles.emptyInline}>None</span>;
    }

    return (
      <ul className={styles.compactList}>
        {value.map((item, index) => (
          <li key={index}>
            {typeof item === 'object' && item !== null ? (
              <JsonTable data={item} />
            ) : (
              String(item)
            )}
          </li>
        ))}
      </ul>
    );
  }

  if (typeof value === 'object' && value !== null) {
    return <JsonTable data={value} />;
  }

  return <span>{value === null || value === undefined ? 'N/A' : String(value)}</span>;
}

function JsonTable({ data }) {
  return (
    <table className={styles.table}>
      <tbody>
        {Object.entries(data).map(([key, value]) => (
          <tr key={key}>
            <th>{key.replaceAll('_', ' ')}</th>
            <td>
              <JsonValue value={value} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ReviewResult({ review }) {
  if (!review) {
    return null;
  }

  if (review.raw_review) {
    const parsedRawReview = parseJsonText(review.raw_review);

    return (
      <section className={styles.result}>
        <h2>Raw Review</h2>
        <p>{review.summary}</p>
        {parsedRawReview ? (
          <JsonTable data={parsedRawReview} />
        ) : (
          <pre className={styles.rawReview}>{review.raw_review}</pre>
        )}
      </section>
    );
  }

  return (
    <section className={styles.result}>
      <div className={styles.scoreHeader}>
        <h2>Review Result</h2>
        <strong>{review.overall_score ?? 'N/A'}/10</strong>
      </div>

      {review.summary ? <p>{review.summary}</p> : null}

      <h3>Category Scores</h3>
      <ScoreTable scores={review.category_scores} />

      <h3>Issues</h3>
      <Issues issues={review.issues} />

      <h3>Security Warnings</h3>
      <TextList
        items={review.security_warnings}
        emptyText="No security warnings returned."
      />

      <h3>Recommendations</h3>
      <TextList
        items={review.recommendations}
        emptyText="No recommendations returned."
      />

      {review.final_advice ? (
        <>
          <h3>Final Advice</h3>
          <p>{review.final_advice}</p>
        </>
      ) : null}
    </section>
  );
}

export default function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [review, setReview] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const acceptValue = useMemo(() => SUPPORTED_EXTENSIONS.join(','), []);

  function handleFileChange(event) {
    setReview(null);
    setError('');
    setSelectedFile(event.target.files?.[0] ?? null);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!selectedFile) {
      setError('Select one source code file before submitting.');
      return;
    }

    setIsLoading(true);
    setError('');
    setReview(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.detail || 'Backend request failed.');
      }

      setReview(data);
    } catch (requestError) {
      setError(requestError.message || 'Unable to review the file.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <h1>AI Code Reviewer</h1>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.fileLabel} htmlFor="code-file">
            Source code file
          </label>
          <input
            id="code-file"
            type="file"
            accept={acceptValue}
            onChange={handleFileChange}
          />

          {selectedFile ? (
            <div className={styles.fileInfo}>
              <span>{selectedFile.name}</span>
              <span>{formatBytes(selectedFile.size)}</span>
            </div>
          ) : null}

          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Reviewing...' : 'Submit'}
          </button>
        </form>

        {error ? <div className={styles.error}>{error}</div> : null}
      </section>

      {isLoading ? <p className={styles.loading}>Review is running...</p> : null}

      <ReviewResult review={review} />
    </main>
  );
}
