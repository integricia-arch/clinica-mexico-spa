import type {ReactNode} from 'react';
import {useCallback} from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import {Search} from 'lucide-react';

function ClinicHero() {
  const {siteConfig} = useDocusaurusContext();

  // El buscador del hero ES el buscador real (docusaurus-search-local) —
  // no un campo decorativo: enfoca el input que el plugin ya monta en el navbar.
  const focusRealSearch = useCallback(() => {
    const realInput = document.querySelector<HTMLInputElement>(
      'input.navbar__search-input, .DocSearch-Button, [class*="searchBox"] input',
    );
    if (realInput) {
      realInput.focus();
      realInput.click();
    }
  }, []);

  return (
    <header className="clinicHero">
      <div className="container">
        <p className="clinicHero__eyebrow">ClínicaMX · Manual de usuario</p>
        <h1 className="clinicHero__title">{siteConfig.title}</h1>
        <p className="clinicHero__subtitle">{siteConfig.tagline}</p>
        <button
          type="button"
          className="clinicHero__searchTrigger"
          onClick={focusRealSearch}
          aria-label="Buscar en el manual"
        >
          <Search size={18} />
          <span>¿Qué necesitas hacer? — ej. "cerrar turno", "aprobar insumo"</span>
          <kbd>/</kbd>
        </button>
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description="Manual de usuario de ClínicaMX — operación, reglas de negocio e implementación por módulo.">
      <ClinicHero />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
