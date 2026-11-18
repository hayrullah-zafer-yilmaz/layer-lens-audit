const SANS = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

export const INSPECTOR_CSS = `
:host { all: initial; }

.panel {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 2147483646;
  display: flex;
  flex-direction: column;
  width: min(380px, calc(100vw - 32px));
  max-height: calc(100vh - 32px);
  box-sizing: border-box;
  overflow: hidden;
  border: 1px solid #dde5f0;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 24px 48px -16px rgb(11 31 58 / 0.35);
  color: #0b1f3a;
  font: 13px/1.45 ${SANS};
  text-align: left;
}
.panel *, .overlay * { box-sizing: border-box; }

.head { display: flex; align-items: center; gap: 4px; padding: 8px 8px 8px 14px; border-bottom: 1px solid #e8eef6; }
.brand { flex: 1; min-width: 0; font-weight: 700; color: #1d4ed8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.scope { margin-left: 6px; font: 500 12px ${MONO}; color: #5b6b82; }
.icon {
  all: unset;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  color: #5b6b82;
  font: 16px/1 ${SANS};
  cursor: pointer;
}
.icon:hover { background: #eff6ff; color: #1d4ed8; }
.icon:focus-visible, .main:focus-visible, .view:focus-visible { outline: 2px solid #2563eb; outline-offset: -2px; }
.icon:disabled { opacity: 0.4; cursor: default; }

.body { overflow: auto; }
.collapsed .body { display: none; }
.collapsed .head { border-bottom: 0; }

.summary { padding: 14px; border-bottom: 1px solid #e8eef6; }
.headline { margin: 0; font-size: 14px; color: #12305c; }
.headline strong { margin-right: 4px; font-size: 26px; line-height: 1.1; color: #dc2626; }
.headline.clean strong { color: #15803d; }
.subline { margin: 2px 0 0; color: #5b6b82; }
.switch { display: flex; align-items: center; gap: 8px; margin-top: 10px; color: #12305c; cursor: pointer; }
.switch input { margin: 0; accent-color: #dc2626; }
.actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.action {
  all: unset;
  padding: 5px 10px;
  border: 1px solid #dde5f0;
  border-radius: 6px;
  color: #12305c;
  font: 600 12px/1.2 ${SANS};
  cursor: pointer;
}
.action:hover { background: #f3f7fd; }
.action:focus-visible { outline: 2px solid #2563eb; outline-offset: 1px; }

.progress { padding: 14px; }
.bar { height: 6px; overflow: hidden; border-radius: 999px; background: #e8eef6; }
.bar span { display: block; width: 0; height: 100%; background: #2563eb; transition: width 120ms linear; }
.progress p { margin: 8px 0 0; color: #5b6b82; }

.hint { margin: 10px 0 0; color: #5b6b82; font-size: 12px; }

.findings { margin: 0; padding: 6px; list-style: none; }
.finding { border-radius: 6px; }
.finding + .finding { margin-top: 2px; }
.finding.open { background: #f8fafd; box-shadow: inset 0 0 0 1px #e8eef6; }
.finding.open .main:not(:hover, :focus-visible) { background: transparent; }
.row { display: flex; align-items: center; gap: 6px; }
.details { padding: 0 12px 12px 26px; color: #12305c; font-size: 12.5px; }
.details .label { margin: 10px 0 3px; color: #5b6b82; font-size: 10.5px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
.details .text { margin: 0; line-height: 1.5; }
.details pre {
  margin: 0;
  padding: 8px 10px;
  overflow-x: auto;
  border: 1px solid #e8eef6;
  border-radius: 6px;
  background: #fff;
  color: #0b1f3a;
  font: 11.5px/1.5 ${MONO};
  white-space: pre;
}
.main { all: unset; display: grid; flex: 1; gap: 3px; min-width: 0; padding: 9px 10px; border-radius: 6px; cursor: pointer; }
.main:hover, .main:focus-visible, .finding.selected .main { background: #f3f7fd; }
.title { display: flex; align-items: center; gap: 8px; font-weight: 600; color: #0b1f3a; }
.dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: #dc2626; }
.finding[data-kind='empty-element'] .dot { background: #d97706; }
.finding[data-kind='dom-size'] .dot, .finding[data-kind='deep-nesting'] .dot, .finding[data-kind='wide-parent'] .dot { background: #2563eb; }
.check { margin-left: auto; padding: 1px 7px; border-radius: 999px; background: #fef3c7; color: #92400e; font-size: 11px; font-weight: 600; }
.where { color: #1d4ed8; font-weight: 500; }
.selector { overflow: hidden; color: #5b6b82; font: 11.5px/1.4 ${MONO}; white-space: nowrap; text-overflow: ellipsis; }
.note { color: #92400e; font-size: 12px; }
.view {
  all: unset;
  flex: none;
  margin-right: 6px;
  padding: 5px 8px;
  border: 1px solid #dde5f0;
  border-radius: 6px;
  color: #1d4ed8;
  font: 700 11px/1 ${SANS};
  cursor: pointer;
}
.view:hover { background: #eff6ff; }
.view[aria-pressed='true'] { border-color: #1d4ed8; background: #1d4ed8; color: #fff; }

.message { margin: 0; padding: 16px 14px; color: #12305c; }
.message.error { color: #b42318; }
.foot { margin: 0; padding: 10px 14px; border-top: 1px solid #e8eef6; color: #5b6b82; font-size: 11.5px; }
.zoom { padding: 8px 12px 10px; border-top: 1px solid #e8eef6; background: #f8fafd; }
.zoom[hidden] { display: none; }
.zoom-controls { display: flex; align-items: center; gap: 2px; }
.zoom-level { min-width: 48px; color: #0b1f3a; font-weight: 700; font-variant-numeric: tabular-nums; text-align: center; }
.zoom-controls .action { margin-left: auto; }
.zoom-hint { margin: 6px 0 0; color: #5b6b82; font-size: 11.5px; }
.flash { color: #15803d; font-weight: 600; }

.overlay { position: fixed; inset: 0; z-index: 2147483645; pointer-events: none; }
.box { position: fixed; border: 2px solid #dc2626; border-radius: 2px; background: rgb(220 38 38 / 0.1); }
.box.faint { border: 1px dashed #dc2626; background: rgb(220 38 38 / 0.05); }
.tag {
  position: absolute;
  left: -2px;
  bottom: 100%;
  padding: 1px 6px;
  border-radius: 4px 4px 4px 0;
  background: #dc2626;
  color: #fff;
  font: 600 11px/16px ${MONO};
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .bar span { transition: none; }
}
`;
