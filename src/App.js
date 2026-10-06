import { useEffect, useRef, useState } from 'preact/hooks';
import { html } from './lib/html.js';
import { buildOfficialTrend, officialFlips, OFFICES, recentOfficialUpdates, STATES, useOfficialSnapshot } from './data/official.js';
import { useHotkey } from './hooks/useHotkey.js';
import { useMediaQuery } from './hooks/useMediaQuery.js';
import { useRoute } from './hooks/useRoute.js';
import { useTheme } from './hooks/useTheme.js';
import { exportMap } from './map/exportMap.js';
import { Insights } from './components/Insights.js';
import { MapStage } from './components/MapStage.js';
import { Scoreboard } from './components/Scoreboard.js';
import { SearchDialog } from './components/SearchDialog.js';
import { SidePanel } from './components/SidePanel.js';
import { TopBar } from './components/TopBar.js';

const SHEET_LAYOUT = '(max-width: 999px)';
const WIDE_LAYOUT = '(min-width: 1440px)';
const FLIP_HIGHLIGHT_MS = 2500;
const NO_FLIPS = new Set();

function useFlipped(states, office) {
  const [flipped, setFlipped] = useState(NO_FLIPS);
  const previous = useRef(null), timer = useRef();

  useEffect(() => {
    const winners = Object.fromEntries(Object.entries(states).map(([uf, result]) => [uf, result.winner]));
    const before = previous.current;
    previous.current = { office, winners };
    if (!before || before.office !== office) return;
    const changed = Object.keys(winners).filter(uf => winners[uf] !== before.winners[uf]);
    if (!changed.length) return;
    setFlipped(new Set(changed));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setFlipped(NO_FLIPS), FLIP_HIGHLIGHT_MS);
  }, [states, office]);
  useEffect(() => () => clearTimeout(timer.current), []);

  return flipped;
}

export function App({ geo }) {
  const route = useRoute(geo);
  const [theme, toggleTheme] = useTheme();
  const [searching, setSearching] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const wide = useMediaQuery(WIDE_LAYOUT), asSheet = useMediaQuery(SHEET_LAYOUT);
  const stage = useRef();

  const { uf, office } = route;
  const municipality = route.municipalityId ? geo.byId.get(route.municipalityId) : null;
  const snapshot = useOfficialSnapshot(geo, office, municipality);
  const zoneRows = null;

  const scope = municipality
    ? { name: municipality.name, result: snapshot.results.get(municipality.id) }
    : uf ? { name: STATES[uf][0], result: snapshot.states[uf] } : { name: 'Brasil', result: snapshot.national };
  const flipped = useFlipped(snapshot.states, office);
  const trend = buildOfficialTrend(snapshot.samples, { uf, municipality }, scope.result);
  const updates = recentOfficialUpdates(snapshot.samples, scope.result, { national: !uf && !municipality });
  const flips = uf ? null : officialFlips(snapshot.samples, snapshot.states);

  const navigation = {
    ...route,
    openState: code => { route.openState(code); setSheetOpen(false); },
    openMunicipality: id => { route.openMunicipality(id); setSheetOpen(false); },
  };

  useHotkey('/', event => { event.preventDefault(); setSearching(true); }, { enabled: !searching });
  useHotkey('Escape', () => {
    if (asSheet && sheetOpen) setSheetOpen(false);
    else if (uf) route.back();
  }, { enabled: !searching });

  const saveMap = () => exportMap({
    frame: stage.current,
    theme,
    filename: `mapa-${municipality?.id || uf || 'brasil'}-tse.png`,
  });

  const insights = html`<${Insights} place=${scope.name} result=${scope.result} trend=${trend}
    flips=${flips} updates=${updates} snapshot=${snapshot}/>`;

  return html`<div class="app">
    <${TopBar} office=${office} onOffice=${route.setOffice} theme=${theme} onToggleTheme=${toggleTheme}
      onSearch=${() => setSearching(true)} onDownload=${saveMap}/>

    <main>
      <${Scoreboard} office=${office} scope=${scope.name} result=${scope.result} majorityRule=${office === OFFICES[0] && !uf}/>
      <div class=${'workspace' + (wide ? ' is-wide' : '')}>
        ${wide && html`<aside class="insights-column" aria-label="Andamento da apuração">${insights}</aside>`}
        <${MapStage} stageRef=${stage} geo=${geo} snapshot=${snapshot} route=${navigation}
          municipality=${municipality} zoneRows=${zoneRows} theme=${theme} flipped=${flipped}/>
        ${asSheet && sheetOpen && html`<div class="sheet-backdrop" onClick=${() => setSheetOpen(false)}></div>`}
        <${SidePanel} geo=${geo} snapshot=${snapshot} route=${navigation} municipality=${municipality}
          zoneRows=${zoneRows} theme=${theme} placeName=${scope.name} insights=${wide ? null : insights}
          sheet=${asSheet ? { open: sheetOpen, toggle: () => setSheetOpen(open => !open) } : null}/>
      </div>
    </main>

    ${searching && html`<${SearchDialog} geo=${geo} onState=${navigation.openState}
      onMunicipality=${navigation.openMunicipality} onClose=${() => setSearching(false)}/>`}
  </div>`;
}
