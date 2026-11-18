export { audit, DEFAULT_LIMITS, type AuditLimits, type AuditOptions } from './audit/audit';
export type { AuditJson, AuditReport, DomStats, Finding, FindingJson, FindingKind } from './audit/report';
export type { SourceHint } from './audit/source';
export { LOCALES, resolveLocale, type Locale } from './i18n';
export { inspect, type Inspector, type InspectOptions } from './inspector/inspector';
export { DEFAULT_SHORTCUT, installInspector, type InstallOptions } from './inspector/shortcut';
export {
  createLayerLensAudit,
  LAYER_LENS_AUDIT_DEFAULTS,
  type LayerLensAudit,
  type LayerLensAuditOptions,
  type LayerLensAuditPhase
} from './view/layerLensAudit';
export type { LayerLensAuditDepth } from './view/layers';
