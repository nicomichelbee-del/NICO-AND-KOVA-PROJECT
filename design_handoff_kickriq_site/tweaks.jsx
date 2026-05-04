/* global React */
const { useEffect: useEffectT } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": "twilight",
  "showTicker": false
}/*EDITMODE-END*/;

// Expose for components that read it during render
window.__kickrTweaks = window.__kickrTweaks || { ...TWEAK_DEFAULTS };

const KickrTweaks = () => {
  const [t, setTweak] = window.useTweaks(TWEAK_DEFAULTS);

  useEffectT(() => {
    document.documentElement.dataset.palette = t.palette;
  }, [t.palette]);

  useEffectT(() => {
    window.__kickrTweaks = { ...t };
    // Force a re-render of consumers (Hero) by dispatching a custom event
    window.dispatchEvent(new CustomEvent('kickr-tweaks-changed'));
  }, [t]);

  const palettes = [
    { value: 'twilight',  label: 'Twilight Gold',  swatch: ['#0d1117', '#f0b65a', '#c94545'] },
    { value: 'pitch',     label: 'Pitch Side',     swatch: ['#0a1410', '#d4a64a', '#6cc890'] },
    { value: 'floodlit',  label: 'Floodlit',       swatch: ['#060912', '#ffcd5c', '#e8b341'] },
    { value: 'crimson',   label: 'Crimson Wire',   swatch: ['#10090c', '#e85a5a', '#f0b65a'] },
    { value: 'pacific',   label: 'Pacific Blue',   swatch: ['#0a1220', '#5fb6ff', '#f0b65a'] },
    { value: 'paper',     label: 'Editorial Paper',swatch: ['#f5f1e8', '#1a1304', '#c94545'] },
  ];

  return (
    <window.TweaksPanel title="Tweaks">
      <window.TweakSection label="Palette" />
      <div className="kickr-palette-grid">
        {palettes.map(p => (
          <button
            key={p.value}
            className={`kickr-palette ${t.palette === p.value ? 'active' : ''}`}
            onClick={() => setTweak('palette', p.value)}
          >
            <span className="kickr-palette-sw">
              <span style={{ background: p.swatch[0] }} />
              <span style={{ background: p.swatch[1] }} />
              <span style={{ background: p.swatch[2] }} />
            </span>
            <span className="kickr-palette-lbl">{p.label}</span>
          </button>
        ))}
      </div>

      <window.TweakSection label="Hero" />
      <window.TweakToggle
        label="Live wire ticker"
        value={t.showTicker}
        onChange={(v) => setTweak('showTicker', v)}
      />
    </window.TweaksPanel>
  );
};

window.KickrTweaks = KickrTweaks;
