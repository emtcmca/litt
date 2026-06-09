import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { T } from '../tokens';
import { Icon } from '../components/ui/Icon';
import { Mono } from '../components/ui/Mono';
import { ConfidenceField, FieldInput, FieldSelect } from '../components/clients/ConfidenceField';
import {
  confirmPendingClient, createClient, extractFromDocument,
  getPendingClients,
} from '../api';
import type { ExtractionResult, PendingClient } from '../types';

const FIRM_ID = 'strand-okafor';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDetected(isoStr: string): string {
  try {
    const now = new Date();
    const t = new Date(isoStr);
    const diffMin = Math.round((now.getTime() - t.getTime()) / 60000);
    if (diffMin < 60) return `${diffMin} min ago`;
    if (diffMin < 1440) return `${Math.round(diffMin / 60)}h ago`;
    return `${Math.round(diffMin / 1440)}d ago`;
  } catch { return ''; }
}

type Conf = 'high' | 'medium' | 'low' | 'not_found' | null;

interface FormState {
  client_name: string;
  client_type: string;
  primary_contact_name: string;
  primary_contact_email: string;
  primary_contact_phone: string;
  billing_rate: string;
  billing_type: string;
  billing_cycle: string;
  payment_terms: string;
  matter_name: string;
  matter_type: string;
  date_engaged: string;
  opposing_counsel: string;
  court: string;
  case_number: string;
}

const EMPTY_FORM: FormState = {
  client_name: '', client_type: 'entity',
  primary_contact_name: '', primary_contact_email: '', primary_contact_phone: '',
  billing_rate: '', billing_type: 'hourly', billing_cycle: 'monthly', payment_terms: 'net_30',
  matter_name: '', matter_type: 'litigation', date_engaged: '',
  opposing_counsel: '', court: '', case_number: '',
};

function extractionToForm(e: ExtractionResult): FormState {
  return {
    client_name:           e.client_name ?? '',
    client_type:           e.client_type ?? 'entity',
    primary_contact_name:  e.primary_contact_name ?? '',
    primary_contact_email: e.primary_contact_email ?? '',
    primary_contact_phone: e.primary_contact_phone ?? '',
    billing_rate:          e.billing_rate != null ? String(e.billing_rate) : '',
    billing_type:          e.billing_type ?? 'hourly',
    billing_cycle:         e.billing_cycle ?? 'monthly',
    payment_terms:         e.payment_terms ?? 'net_30',
    matter_name:           e.matter_name ?? '',
    matter_type:           e.matter_type ?? 'litigation',
    date_engaged:          e.date_engaged ?? '',
    opposing_counsel:      e.opposing_counsel ?? '',
    court:                 e.court ?? '',
    case_number:           e.case_number ?? '',
  };
}

const conf = (extraction: ExtractionResult | null, field: string): Conf => {
  if (!extraction) return null;
  const c = extraction.confidence?.[field];
  return (c as Conf) ?? null;
};

// ── Sub-components ────────────────────────────────────────────────────────────

function ConfLegend() {
  const swatches: [string, string, string][] = [
    ['Stated in letter', T.teal,   '3px solid'],
    ['Implied — review', T.gold,   '3px solid'],
    ['Inferred — check', T.danger, '3px solid'],
    ['Not found — add',  T.faint,  '3px solid'],
  ];
  return (
    <div style={{
      display: 'flex', gap: 18, flexWrap: 'wrap',
      background: T.wash2, borderRadius: 10, padding: '10px 14px',
    }}>
      {swatches.map(([label, color]) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 3, height: 14, background: color, borderRadius: 1, flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: T.muted }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

function DocPanel({ file, isPending }: { file: File | null; isPending: boolean }) {
  const url = file ? URL.createObjectURL(file) : null;
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.line}`,
      borderRadius: 14, overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 16px', borderBottom: `1px solid ${T.soft}`,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <Mono style={{ fontSize: 11, color: T.ink, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {file ? file.name : 'Cordova-Engagement-Letter-signed.pdf'}
        </Mono>
        <Mono style={{
          fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em',
          color: T.teal, background: T.tealSoft,
          border: `1px solid rgba(29,158,117,.28)`, borderRadius: 4, padding: '1px 6px', flexShrink: 0,
        }}>PDF</Mono>
      </div>
      {isPending || !url ? (
        // Striped placeholder for pending path (no real File object)
        <div style={{
          minHeight: 460, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 12,
          background: `repeating-linear-gradient(
            -45deg,
            ${T.wash2} 0px,
            ${T.wash2} 10px,
            ${T.surface} 10px,
            ${T.surface} 20px
          )`,
        }}>
          <Icon name="book" size={28} color={T.faint} />
          <Mono style={{ fontSize: 11, color: T.faint, textAlign: 'center', padding: '0 24px' }}>
            Document held in Litt's watched inbox — preview unavailable
          </Mono>
        </div>
      ) : (
        <embed
          src={url}
          type="application/pdf"
          width="100%"
          style={{ minHeight: 460, display: 'block' }}
        />
      )}
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Mono style={{
        fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em',
        color: T.faint, borderBottom: `1px solid ${T.soft}`, paddingBottom: 6,
      }}>
        {label}
      </Mono>
      {children}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

type Stage = 'uploading' | 'extracting' | 'reviewing' | 'confirming';
type EntryType = 'upload' | 'pending';

export function ClientNew() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pendingId = searchParams.get('pending');

  const [stage, setStage]             = useState<Stage>('uploading');
  const [entry, setEntry]             = useState<EntryType>('upload');
  const [file, setFile]               = useState<File | null>(null);
  const [extraction, setExtraction]   = useState<ExtractionResult | null>(null);
  const [form, setForm]               = useState<FormState>(EMPTY_FORM);
  const [pendingItems, setPending]     = useState<PendingClient[]>([]);
  const [dragOver, setDragOver]       = useState(false);
  const [extractErr, setExtractErr]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load pending clients for the auto-onboard panel
  useEffect(() => {
    getPendingClients(FIRM_ID).then(setPending).catch(() => setPending([]));
  }, []);

  // If URL has ?pending=id, jump straight to reviewing
  useEffect(() => {
    if (!pendingId || pendingItems.length === 0) return;
    const item = pendingItems.find(p => p.id === pendingId);
    if (!item) return;
    setEntry('pending');
    setExtraction(item.extraction as unknown as ExtractionResult);
    setForm(extractionToForm(item.extraction as unknown as ExtractionResult));
    setStage('reviewing');
  }, [pendingId, pendingItems]);

  // ── File handling ──────────────────────────────────────────────────────────

  async function handleFile(f: File) {
    setFile(f);
    setStage('extracting');
    setExtractErr(false);
    try {
      const result = await extractFromDocument(FIRM_ID, f);
      setExtraction(result);
      setForm(extractionToForm(result));
    } catch {
      setExtractErr(true);
      setExtraction(null);
      setForm(EMPTY_FORM);
    }
    setEntry('upload');
    setStage('reviewing');
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.type === 'application/pdf') handleFile(f);
  }

  // ── Confirm ───────────────────────────────────────────────────────────────

  const requiredFilled =
    form.client_name.trim() !== '' &&
    form.primary_contact_name.trim() !== '' &&
    form.primary_contact_email.trim() !== '' &&
    form.billing_rate.trim() !== '' &&
    form.matter_name.trim() !== '' &&
    form.date_engaged.trim() !== '';

  async function handleConfirm() {
    if (!requiredFilled) return;
    setStage('confirming');
    try {
      let clientId: string;
      if (entry === 'pending' && pendingId) {
        const res = await confirmPendingClient(pendingId, {}, FIRM_ID, 'dana-strand');
        clientId = res.client_id;
      } else {
        const res = await createClient({
          firm_id: FIRM_ID,
          client_name: form.client_name,
          client_type: form.client_type,
          primary_contact_name: form.primary_contact_name,
          primary_contact_email: form.primary_contact_email,
          primary_contact_phone: form.primary_contact_phone || '',
          billing_rate: parseFloat(form.billing_rate) || 0,
          billing_type: form.billing_type,
          billing_cycle: form.billing_cycle,
          payment_terms: form.payment_terms,
          engagement_type: form.matter_type,
          date_engaged: form.date_engaged,
          responsible_attorney_id: 'dana-strand',
          conflict_check_names: [],
          silence_threshold_days: 14,
          budget_cap: null,
          notes: null,
          engagement_letter_ref: null,
          first_matter: {
            matter_name: form.matter_name,
            matter_type: form.matter_type,
            opposing_counsel: form.opposing_counsel || null,
            court: form.court || null,
            case_number: form.case_number || null,
          },
        });
        clientId = res.client_id;
      }
      navigate(`/clients/${clientId}`);
    } catch {
      setStage('reviewing');
    }
  }

  function setField(key: keyof FormState) {
    return (v: string) => setForm(f => ({ ...f, [key]: v }));
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const pendingItem = pendingItems[0] ?? null;

  // Uploading + extracting stage
  if (stage === 'uploading' || stage === 'extracting') {
    return (
      <div style={{ overflowY: 'auto', padding: '24px 30px 60px', height: '100%' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'grid', gap: 24 }}>

          {/* Back */}
          <Link to="/clients" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 13, color: T.muted, textDecoration: 'none',
            fontFamily: 'var(--font-sans)',
          }}>
            <Icon name="chevron" size={13} color={T.muted} style={{ transform: 'rotate(180deg)' }} />
            Clients
          </Link>

          {/* Header */}
          <div>
            <h1 style={{ margin: '0 0 6px', fontSize: 26, fontWeight: 600, letterSpacing: '-.02em', color: T.ink }}>
              Add a client
            </h1>
            <p style={{ margin: 0, fontSize: 14, color: T.muted, lineHeight: 1.5 }}>
              Drop the engagement letter. Gemini extracts the profile and first matter — you review everything before anything is saved.
            </p>
          </div>

          {/* Drop zone */}
          <button
            onClick={() => stage === 'uploading' && fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            disabled={stage === 'extracting'}
            style={{
              width: '100%', border: `2px dashed ${dragOver ? T.gold : T.line}`,
              borderRadius: 14, padding: 46,
              background: 'transparent', cursor: stage === 'extracting' ? 'default' : 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
              transition: 'border-color .15s',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {stage === 'extracting' ? (
              <>
                <div className="ag-spin" style={{ width: 32, height: 32 }} />
                <span style={{ fontSize: 15, fontWeight: 600, color: T.ink }}>Reading the engagement letter…</span>
                <Mono style={{ fontSize: 11, color: T.faint }}>
                  gemini-2.5-pro · structured extraction · nothing saved yet
                </Mono>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {['Parsing document', 'Extracting fields', 'Mapping confidence'].map(s => (
                    <Mono key={s} style={{
                      fontSize: 10, color: T.auditAccent,
                      background: T.audit, borderRadius: 5, padding: '3px 8px',
                    }}>{s}</Mono>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div style={{
                  width: 56, height: 56, borderRadius: 9,
                  background: T.wash2, display: 'grid', placeItems: 'center', flexShrink: 0,
                }}>
                  <Icon name="book" size={24} color={T.muted} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: T.ink }}>Drop engagement letter here</div>
                  <Mono style={{ fontSize: 12, color: T.faint, marginTop: 4 }}>or click to select a PDF</Mono>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}
                  style={{
                    background: T.forest, color: T.brass,
                    fontSize: 13, fontWeight: 600,
                    padding: '11px 22px', borderRadius: 10,
                    border: 'none', cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  Select PDF
                </button>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              style={{ display: 'none' }}
              onChange={onFileChange}
            />
          </button>

          {/* Auto-onboard panel */}
          <div style={{
            background: T.audit, borderRadius: 14, padding: '18px 20px',
            display: 'grid', gap: 14,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="refresh" size={14} color={T.auditAccent} />
              <Mono style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.04em', color: T.auditAccent }}>
                Litt can also find new clients automatically
              </Mono>
            </div>
            <p style={{ margin: 0, fontSize: 13.5, color: '#EFEBDB', lineHeight: 1.55 }}>
              When a signed engagement letter lands in your watched inbox, Litt extracts the same profile and holds it as a{' '}
              <strong>pending client</strong> — ready for one-click confirm. You never start from a blank form.
            </p>

            {pendingItem && (
              <div style={{
                background: 'rgba(0,0,0,.2)', borderRadius: 10, padding: '12px 14px',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: 999,
                  background: T.gold, flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#EFEBDB' }}>
                    {pendingItem.proposed_name}
                  </div>
                  <Mono style={{ fontSize: 10.5, color: T.auditMuted, marginTop: 2 }}>
                    {pendingItem.via} · detected {fmtDetected(pendingItem.detected_at)}
                  </Mono>
                </div>
                <button
                  onClick={() => {
                    setEntry('pending');
                    setExtraction(pendingItem.extraction as unknown as ExtractionResult);
                    setForm(extractionToForm(pendingItem.extraction as unknown as ExtractionResult));
                    setStage('reviewing');
                  }}
                  style={{
                    background: 'transparent', color: T.brass,
                    border: `1px solid ${T.brass}`,
                    fontSize: 12, fontWeight: 600,
                    padding: '7px 14px', borderRadius: 8,
                    cursor: 'pointer', fontFamily: 'var(--font-sans)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Review draft
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    );
  }

  // Reviewing + confirming stage
  const ex = extraction;
  const needsReview = ex
    ? Object.values(ex.confidence ?? {}).filter(c => c === 'medium' || c === 'low').length
    : 0;

  return (
    <div style={{ overflowY: 'auto', padding: '24px 30px 60px', height: '100%' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', display: 'grid', gap: 20 }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          gap: 16, flexWrap: 'wrap',
        }}>
          <div>
            <Link to="/clients" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 13, color: T.muted, textDecoration: 'none',
              fontFamily: 'var(--font-sans)', marginBottom: 10,
            }}>
              <Icon name="chevron" size={13} color={T.muted} style={{ transform: 'rotate(180deg)' }} />
              Clients
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-.02em', color: T.ink }}>
                Review extraction
              </h1>
              {entry === 'pending' && (
                <Mono style={{
                  fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em',
                  color: T.gold, background: 'rgba(169,132,53,.1)',
                  border: '1px solid rgba(169,132,53,.3)', borderRadius: 5, padding: '2px 7px',
                }}>
                  auto-drafted · held
                </Mono>
              )}
            </div>
            {ex && (
              <Mono style={{ fontSize: 11, color: T.faint, marginTop: 5, display: 'block' }}>
                {ex.fields_extracted_count} of {ex.fields_total} fields extracted
                {needsReview > 0 ? ` · ${needsReview} need review` : ''}
                {extractErr ? ' · extraction failed — manual entry' : ' · nothing saved until you confirm'}
              </Mono>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
            <button
              onClick={() => setStage('uploading')}
              style={{
                background: 'transparent', color: T.muted,
                border: `1px solid ${T.line}`,
                fontSize: 13, fontWeight: 600,
                padding: '10px 16px', borderRadius: 9,
                cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}
            >
              Back
            </button>
            <button
              onClick={handleConfirm}
              disabled={!requiredFilled || stage === 'confirming'}
              style={{
                background: requiredFilled ? T.forest : T.wash2,
                color: requiredFilled ? T.brass : T.faint,
                border: 'none',
                fontSize: 13, fontWeight: 600,
                padding: '10px 18px', borderRadius: 9,
                cursor: requiredFilled ? 'pointer' : 'default',
                fontFamily: 'var(--font-sans)',
                display: 'flex', alignItems: 'center', gap: 7,
                transition: 'background .15s, color .15s',
              }}
            >
              {stage === 'confirming' ? (
                <>
                  <div className="ag-spin" style={{ width: 14, height: 14 }} />
                  Adding {form.client_name}…
                </>
              ) : (
                <>
                  <Icon name="check" size={14} color={requiredFilled ? T.brass : T.faint} />
                  Confirm &amp; add client
                </>
              )}
            </button>
          </div>
        </div>

        {stage === 'confirming' && (
          <Mono style={{ fontSize: 11, color: T.teal }}>
            create_client() · create_matter() · log_audit_event()
          </Mono>
        )}

        {/* Confidence legend */}
        <ConfLegend />

        {/* Side-by-side grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.15fr',
          gap: 20,
        }}>
          {/* Left — doc panel */}
          <DocPanel file={file} isPending={entry === 'pending'} />

          {/* Right — extracted form */}
          <div style={{
            background: T.surface, border: `1px solid ${T.line}`,
            borderRadius: 14, padding: 18,
            display: 'grid', gap: 22, alignContent: 'start',
          }}>
            <FieldGroup label="Client">
              <ConfidenceField label="Client name" required conf={conf(ex, 'client_name')}>
                <FieldInput value={form.client_name} onChange={setField('client_name')} conf={conf(ex, 'client_name')} required />
              </ConfidenceField>
              <ConfidenceField label="Type" conf={conf(ex, 'client_type')}>
                <FieldSelect
                  value={form.client_type}
                  onChange={setField('client_type')}
                  conf={conf(ex, 'client_type')}
                  options={[
                    { value: 'entity', label: 'Entity' },
                    { value: 'individual', label: 'Individual' },
                    { value: 'trust', label: 'Trust' },
                    { value: 'estate', label: 'Estate' },
                  ]}
                />
              </ConfidenceField>
              <ConfidenceField label="Primary contact" required conf={conf(ex, 'primary_contact_name')}>
                <FieldInput value={form.primary_contact_name} onChange={setField('primary_contact_name')} conf={conf(ex, 'primary_contact_name')} required />
              </ConfidenceField>
              <ConfidenceField label="Email" required conf={conf(ex, 'primary_contact_email')}>
                <FieldInput value={form.primary_contact_email} onChange={setField('primary_contact_email')} conf={conf(ex, 'primary_contact_email')} type="email" required />
              </ConfidenceField>
              <ConfidenceField label="Phone" conf={conf(ex, 'primary_contact_phone')}>
                <FieldInput value={form.primary_contact_phone} onChange={setField('primary_contact_phone')} conf={conf(ex, 'primary_contact_phone')} type="tel" />
              </ConfidenceField>
            </FieldGroup>

            <FieldGroup label="Billing">
              <ConfidenceField label="Rate ($/hr)" required conf={conf(ex, 'billing_rate')}>
                <FieldInput value={form.billing_rate} onChange={setField('billing_rate')} conf={conf(ex, 'billing_rate')} type="number" required />
              </ConfidenceField>
              <ConfidenceField label="Billing type" conf={conf(ex, 'billing_type')}>
                <FieldSelect
                  value={form.billing_type}
                  onChange={setField('billing_type')}
                  conf={conf(ex, 'billing_type')}
                  options={[
                    { value: 'hourly', label: 'Hourly' },
                    { value: 'flat', label: 'Flat fee' },
                    { value: 'contingency', label: 'Contingency' },
                  ]}
                />
              </ConfidenceField>
              <ConfidenceField label="Billing cycle" conf={conf(ex, 'billing_cycle')}>
                <FieldSelect
                  value={form.billing_cycle}
                  onChange={setField('billing_cycle')}
                  conf={conf(ex, 'billing_cycle')}
                  options={[
                    { value: 'monthly', label: 'Monthly' },
                    { value: 'quarterly', label: 'Quarterly' },
                    { value: 'upon_completion', label: 'Upon completion' },
                  ]}
                />
              </ConfidenceField>
              <ConfidenceField label="Payment terms" conf={conf(ex, 'payment_terms')}>
                <FieldSelect
                  value={form.payment_terms}
                  onChange={setField('payment_terms')}
                  conf={conf(ex, 'payment_terms')}
                  options={[
                    { value: 'net_30', label: 'Net 30' },
                    { value: 'net_15', label: 'Net 15' },
                    { value: 'due_on_receipt', label: 'Due on receipt' },
                  ]}
                />
              </ConfidenceField>
            </FieldGroup>

            <FieldGroup label="Matter">
              <ConfidenceField label="Matter name" required conf={conf(ex, 'matter_name')}>
                <FieldInput value={form.matter_name} onChange={setField('matter_name')} conf={conf(ex, 'matter_name')} required />
              </ConfidenceField>
              <ConfidenceField label="Matter type" conf={conf(ex, 'matter_type')}>
                <FieldSelect
                  value={form.matter_type}
                  onChange={setField('matter_type')}
                  conf={conf(ex, 'matter_type')}
                  options={[
                    { value: 'litigation', label: 'Litigation' },
                    { value: 'transactional', label: 'Transactional' },
                    { value: 'advisory', label: 'Advisory' },
                    { value: 'estate', label: 'Estate' },
                    { value: 'corporate', label: 'Corporate' },
                  ]}
                />
              </ConfidenceField>
              <ConfidenceField label="Date engaged" required conf={conf(ex, 'date_engaged')}>
                <FieldInput value={form.date_engaged} onChange={setField('date_engaged')} conf={conf(ex, 'date_engaged')} type="date" required />
              </ConfidenceField>
              <ConfidenceField label="Opposing counsel" conf={conf(ex, 'opposing_counsel')}>
                <FieldInput value={form.opposing_counsel} onChange={setField('opposing_counsel')} conf={conf(ex, 'opposing_counsel')} />
              </ConfidenceField>
              <ConfidenceField label="Court" conf={conf(ex, 'court')}>
                <FieldInput value={form.court} onChange={setField('court')} conf={conf(ex, 'court')} />
              </ConfidenceField>
              <ConfidenceField label="Case number" conf={conf(ex, 'case_number')}>
                <FieldInput value={form.case_number} onChange={setField('case_number')} conf={conf(ex, 'case_number')} />
              </ConfidenceField>
            </FieldGroup>

            {ex?.extraction_notes && (
              <div style={{ paddingTop: 4 }}>
                <Mono style={{ fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: T.faint, display: 'block', marginBottom: 6 }}>
                  Gemini's note
                </Mono>
                <Mono style={{ fontSize: 11, color: T.faint, lineHeight: 1.5 }}>
                  {ex.extraction_notes}
                </Mono>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
