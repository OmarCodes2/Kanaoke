import { useEffect, useMemo, useState } from 'react';
import type { AnkiStatus, DisplayToken } from '../types';
import DictionarySetup from './DictionarySetup';
import { useDictionaryLookup } from '../hooks/useDictionaryLookup';
import styles from './RightTokenPanel.module.css';

interface RightTokenPanelProps {
  token: DisplayToken | null;
  sentence: string;
  sentenceTranslation: string;
  songId: string;
  songTitle: string;
}

export default function RightTokenPanel({
  token,
  sentence,
  sentenceTranslation,
  songId,
  songTitle,
}: RightTokenPanelProps) {
  const { status, results, loading } = useDictionaryLookup(token);
  const [ankiStatus, setAnkiStatus] = useState<AnkiStatus | null>(null);
  const [showAnkiForm, setShowAnkiForm] = useState(false);
  const [deckName, setDeckName] = useState('Japanese::Kanaoke');
  const [creatingDeck, setCreatingDeck] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');
  const [meaning, setMeaning] = useState('');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const suggestedMeaning = useMemo(
    () => results[0]?.senses.flatMap((sense) => sense.glosses).join('; ') || '',
    [results],
  );

  const refreshAnkiStatus = async () => {
    const nextStatus = await window.electronAPI.getAnkiStatus();
    setAnkiStatus(nextStatus);
    setDeckName((current) => {
      return nextStatus.decks.includes(current) ? current : nextStatus.decks[0] || current;
    });
  };

  useEffect(() => {
    refreshAnkiStatus().catch(() => {
      setAnkiStatus({
        connected: false,
        message: 'Open Anki with AnkiConnect to add a card.',
        decks: [],
      });
    });
  }, []);

  useEffect(() => {
    setMeaning(suggestedMeaning);
    setSaveMessage(null);
    setShowAnkiForm(false);
    setCreatingDeck(false);
  }, [token?.surface, suggestedMeaning]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleOpenAnkiForm = () => {
    setShowAnkiForm(true);
    setSaveMessage(null);
    refreshAnkiStatus().catch(() => {
      setSaveMessage('Could not refresh the Anki deck list.');
    });
  };

  useEffect(() => {
    if (!showAnkiForm) return undefined;

    const refreshDecksWhenFocused = () => {
      refreshAnkiStatus().catch(() => {
        setSaveMessage('Could not refresh the Anki deck list.');
      });
    };

    window.addEventListener('focus', refreshDecksWhenFocused);
    return () => window.removeEventListener('focus', refreshDecksWhenFocused);
  }, [showAnkiForm]);

  const handleCreateDeck = async () => {
    try {
      const createdName = await window.electronAPI.createAnkiDeck(newDeckName);
      setDeckName(createdName);
      setNewDeckName('');
      setCreatingDeck(false);
      setSaveMessage(`Created ${createdName}.`);
      await refreshAnkiStatus();
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : 'Could not create the deck.');
    }
  };

  const handleSaveCard = async () => {
    if (!token) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const result = await window.electronAPI.saveAnkiCard({
        expression: token.base || token.surface,
        reading: token.reading,
        meaning,
        sentence,
        sentenceTranslation,
        songId,
        songTitle,
      }, deckName);
      setSaveMessage(result.message);
      await refreshAnkiStatus();
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : 'Could not save this card.');
    } finally {
      setSaving(false);
    }
  };

  const renderMeaningSection = () => {
    if (!token) {
      return null;
    }

    if (
      status.status === 'not-configured' ||
      status.status === 'error' ||
      status.status === 'downloading' ||
      status.status === 'building'
    ) {
      return <DictionarySetup status={status} compact />;
    }

    if (loading) {
      return <div className={styles.placeholder}>Looking up meaning...</div>;
    }

    if (results.length === 0) {
      return <div className={styles.placeholder}>No definition found</div>;
    }

    return (
      <div className={styles.meanings}>
        {results.map((result) => (
          <div key={result.id} className={styles.meaningEntry}>
            {(result.kanji.length > 0 || result.kana.length > 0) && (
              <div className={styles.meaningHeadword}>
                {[...new Set([...result.kanji, ...result.kana])].join(' · ')}
              </div>
            )}
            {result.senses.map((sense, senseIndex) => (
              <div key={`${result.id}-${senseIndex}`} className={styles.sense}>
                {sense.partOfSpeech.length > 0 && (
                  <div className={styles.pos}>{sense.partOfSpeech.join(', ')}</div>
                )}
                <div className={styles.gloss}>{sense.glosses.join('; ')}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3>Word Info</h3>
      </div>

      <div className={styles.content}>
        {token ? (
          <>
            <div className={styles.section}>
              <div className={styles.label}>Surface Form</div>
              <div className={styles.surfaceForm}>{token.surface}</div>
            </div>

            {token.base !== token.surface && (
              <div className={styles.section}>
                <div className={styles.label}>Base Form</div>
                <div className={styles.value}>{token.base}</div>
              </div>
            )}

            {token.reading && (
              <div className={styles.section}>
                <div className={styles.label}>Reading</div>
                <div className={styles.value}>{token.reading}</div>
                <button
                  className={styles.copyButton}
                  onClick={() => handleCopy(token.reading)}
                  title="Copy reading"
                >
                  Copy
                </button>
              </div>
            )}

            {token.pronunciation && token.pronunciation !== token.reading && (
              <div className={styles.section}>
                <div className={styles.label}>Pronunciation</div>
                <div className={styles.value}>{token.pronunciation}</div>
              </div>
            )}

            {token.underlyingTokens.length > 1 && (
              <div className={styles.section}>
                <div className={styles.label}>Token Breakdown</div>
                <div className={styles.breakdown}>
                  {token.underlyingTokens.map((underlying, idx) => (
                    <div key={idx} className={styles.breakdownItem}>
                      <div className={styles.breakdownSurface}>{underlying.surface}</div>
                      <div className={styles.breakdownDetails}>
                        <span className={styles.breakdownPos}>{underlying.pos}</span>
                        {underlying.base !== underlying.surface && (
                          <span className={styles.breakdownBase}>
                            {underlying.base}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.section}>
              <div className={styles.label}>Meaning</div>
              {renderMeaningSection()}
            </div>

            <div className={styles.actions}>
              <button
                className={styles.actionButton}
                onClick={() => handleCopy(token.surface)}
              >
                Copy Surface
              </button>
              {token.reading && (
                <button
                  className={styles.actionButton}
                  onClick={() => handleCopy(token.reading)}
                >
                  Copy Reading
                </button>
              )}
            </div>

            <section className={styles.ankiSection} aria-label="Add this word to Anki">
              <div className={styles.ankiHeading}>
                <div>
                  <div className={styles.label}>Anki</div>
                  <div className={`${styles.ankiStatus} ${ankiStatus?.connected ? styles.connected : ''}`}>
                    {ankiStatus?.connected ? 'Connected' : 'Not connected'}
                  </div>
                </div>
              </div>

              {!showAnkiForm ? (
                <button className={`${styles.addAnkiButton} primary`} onClick={handleOpenAnkiForm}>
                  Add to Anki
                </button>
              ) : (
                <div className={styles.ankiForm}>
                  <p className={styles.ankiHint}>{ankiStatus?.message}</p>
                  {ankiStatus?.connected ? (
                    <>
                      <label className={styles.formLabel} htmlFor="anki-deck">Deck</label>
                      <select id="anki-deck" value={deckName} onChange={(event) => setDeckName(event.target.value)}>
                        {ankiStatus.decks.map((deck) => <option key={deck} value={deck}>{deck}</option>)}
                      </select>
                      {creatingDeck ? (
                        <div className={styles.newDeckRow}>
                          <input value={newDeckName} onChange={(event) => setNewDeckName(event.target.value)} placeholder="Japanese::Kanaoke" />
                          <button className={styles.compactButton} onClick={handleCreateDeck}>Create</button>
                        </div>
                      ) : (
                        <button className={styles.textButton} onClick={() => setCreatingDeck(true)}>+ New deck</button>
                      )}
                    </>
                  ) : (
                    <div className={styles.setupGuide}>
                      <p className={styles.pendingDeckHint}>
                        Open Anki with AnkiConnect, then return here to add this card.
                      </p>
                      <ol>
                        <li>Install and open Anki Desktop.</li>
                        <li>In Anki, go to <strong>Tools → Add-ons → Get Add-ons</strong>.</li>
                        <li>Paste <code>2055492159</code> to install AnkiConnect, then restart Anki.</li>
                      </ol>
                      <button className={styles.textButton} onClick={() => refreshAnkiStatus()}>Check connection again</button>
                    </div>
                  )}

                  <label className={styles.formLabel} htmlFor="anki-meaning">Meaning</label>
                  <textarea id="anki-meaning" value={meaning} onChange={(event) => setMeaning(event.target.value)} rows={2} placeholder="Add a meaning" />
                  <div className={styles.cardPreview}>
                    <span>{token.base || token.surface}</span>
                    <small>{token.reading}</small>
                    <small>{sentence}</small>
                    {sentenceTranslation && <small>{sentenceTranslation}</small>}
                  </div>
                  {saveMessage && <p className={styles.saveMessage}>{saveMessage}</p>}
                  <button className={`${styles.addAnkiButton} primary`} onClick={handleSaveCard} disabled={saving || !meaning.trim()}>
                    Add to Anki
                  </button>
                </div>
              )}
            </section>
          </>
        ) : (
          <div className={styles.emptyState}>
            <p>Click a word to see its information</p>
          </div>
        )}
      </div>
    </div>
  );
}
