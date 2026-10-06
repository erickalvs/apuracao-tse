import { html } from '../lib/html.js';
import { OFFICES } from '../data/official.js';
import { Icon } from './Icon.js';

export function TopBar({ office, onOffice, theme, onToggleTheme, onSearch, onDownload }) {
  const nextTheme = theme === 'dark' ? 'claro' : 'escuro';
  return html`<header class="topbar">
    <div class="brand">
      <h1>Apuração 2026</h1>
      <span class="sim-chip" title="Resultados carregados dos arquivos oficiais de divulgacao do TSE.">Dados oficiais do TSE</span>
    </div>

    <nav class="office-tabs" aria-label="Cargo">
      ${OFFICES.map(name => html`<button key=${name} class="office-tab" aria-pressed=${name === office}
        onClick=${() => onOffice(name)}>${name}</button>`)}
    </nav>

    <div class="topbar-actions">
      <button class="search-trigger" onClick=${onSearch} aria-label="Buscar estado ou município" aria-keyshortcuts="/">
        <${Icon} name="search" size=${16}/><span>Buscar um lugar</span><kbd>/</kbd>
      </button>
      <button class="icon-button" onClick=${onToggleTheme} aria-label=${`Mudar para o tema ${nextTheme}`} title=${`Tema ${nextTheme}`}>
        <${Icon} name=${theme === 'dark' ? 'sun' : 'moon'}/>
      </button>
      <button class="icon-button" onClick=${onDownload} aria-label="Salvar mapa como imagem" title="Salvar mapa como imagem">
        <${Icon} name="download"/>
      </button>
    </div>
  </header>`;
}
