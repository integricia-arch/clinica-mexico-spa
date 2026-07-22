import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'IntegriKa — Manual de Usuario',
  tagline: 'Cómo operar el sistema, módulo por módulo',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://integrika.mx',
  // Servido como subruta estática del mismo Worker, junto a la SPA principal
  baseUrl: '/manual/',

  organizationName: 'integricia-arch',
  projectName: 'clinica-mexico-spa',

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'es',
    locales: ['es'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          // Fuente única: el mismo contenido que abre el botón "?" dentro de la app
          path: '../docs/manual-usuario',
          routeBasePath: '/',
          exclude: ['_TEMPLATE.md', 'README.md'],
          editUrl: 'https://github.com/integricia-arch/clinica-mexico-spa/tree/main/docs/manual-usuario/',
        },
        blog: {
          path: 'blog',
          routeBasePath: 'blog',
          blogTitle: 'Blog IntegriKa',
          blogDescription: 'Guías y artículos sobre gestión de clínicas y consultorios en México: agenda, CFDI, farmacia, corte de caja, expediente clínico.',
          showReadingTime: true,
          postsPerPage: 10,
          blogSidebarTitle: 'Artículos recientes',
          blogSidebarCount: 10,
          feedOptions: {
            type: ['rss', 'atom'],
            title: 'Blog IntegriKa',
          },
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/docusaurus-social-card.jpg',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Manual de Usuario',
      logo: {
        alt: 'IntegriKa',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Módulos',
        },
        {
          to: '/blog',
          label: 'Blog',
          position: 'left',
        },
        {
          href: 'https://integrika.mx',
          label: 'Volver al sistema',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [],
      copyright: `IntegriKa · Manual de Usuario y Blog · ${new Date().getFullYear()}`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,

  themes: [
    [
      '@easyops-cn/docusaurus-search-local',
      {
        hashed: true,
        language: ['es', 'en'],
        indexDocs: true,
        indexBlog: true,
        indexPages: false,
      },
    ],
  ],
};

export default config;
