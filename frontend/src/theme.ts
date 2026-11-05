import type { ThemeConfig } from 'antd';

// Ant Design set to the framed-sheet tokens (styles/platform.css): near-black primary, flat surfaces,
// no shadows at rest, 6px controls, sentence-case grey table headers with no band.
export const theme: ThemeConfig = {
  token: {
    colorPrimary: '#1d1f20',
    colorLink: '#1b6c80',
    colorText: '#131416',
    colorTextSecondary: '#5d5f60',
    colorBorder: '#cdced1',
    colorBorderSecondary: '#e8eaec',
    colorBgLayout: '#f9fbfc',
    colorSuccess: '#1e7b4f',
    colorError: '#c4242a',
    colorWarning: '#92400e',
    fontFamily: '"IBM Plex Sans", Inter, system-ui, sans-serif',
    fontFamilyCode: '"IBM Plex Mono", ui-monospace, monospace',
    fontSize: 14,
    borderRadius: 6,
    borderRadiusLG: 8,
    controlHeight: 32,
    boxShadow: 'none',
    boxShadowSecondary: '0 6px 24px rgba(0,0,0,.10)',
    wireframe: false,
  },
  components: {
    Button: { primaryShadow: 'none', defaultShadow: 'none', dangerShadow: 'none', fontWeight: 500 },
    Table: { headerBg: '#ffffff', headerColor: '#5d5f60', headerSplitColor: 'transparent', borderColor: '#f0f1f2', rowHoverBg: '#f4f6f8', cellPaddingBlock: 14, headerBorderRadius: 0 },
    Tabs: { inkBarColor: '#131416', itemSelectedColor: '#131416', itemHoverColor: '#131416', itemColor: '#5d5f60', horizontalItemGutter: 24 },
    Input: { activeShadow: 'none' },
    Select: { optionSelectedBg: '#ebedee' },
    Segmented: { itemSelectedBg: '#ffffff', trackBg: '#f4f6f8' },
  },
};
