import type { ThemeConfig } from 'antd';

// Ant Design set to the Codes Tech brand on the framed-sheet style (styles/platform.css):
// Deep Space Navy for the one primary action, Royal Ocean Blue for links, focus and the main data,
// flat surfaces, no shadows at rest, 6px controls, Inter.
export const theme: ThemeConfig = {
  token: {
    colorPrimary: '#0B2545',
    colorLink: '#0066FF',
    colorInfo: '#0066FF',
    colorText: '#0B2545',
    colorTextSecondary: '#526077',
    colorBorder: '#cbd3df',
    colorBorderSecondary: '#e2e8f0',
    colorBgLayout: '#f5f8fc',
    colorSuccess: '#1e7b4f',
    colorError: '#c4242a',
    colorWarning: '#92400e',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontFamilyCode: '"IBM Plex Mono", ui-monospace, monospace',
    fontSize: 14,
    borderRadius: 6,
    borderRadiusLG: 8,
    controlHeight: 32,
    boxShadow: 'none',
    boxShadowSecondary: '0 6px 24px rgba(11,37,69,.12)',
    wireframe: false,
  },
  components: {
    Button: { primaryShadow: 'none', defaultShadow: 'none', dangerShadow: 'none', fontWeight: 500 },
    Table: { headerBg: '#ffffff', headerColor: '#526077', headerSplitColor: 'transparent', borderColor: '#eef2f6', rowHoverBg: '#f3f6fa', cellPaddingBlock: 14, headerBorderRadius: 0 },
    Tabs: { inkBarColor: '#0B2545', itemSelectedColor: '#0B2545', itemHoverColor: '#0B2545', itemColor: '#526077', horizontalItemGutter: 24 },
    Input: { activeShadow: 'none' },
    InputNumber: { activeShadow: 'none' },
    Select: { optionSelectedBg: '#e8eef6' },
    Segmented: { itemSelectedBg: '#ffffff', trackBg: '#e8eef6' },
    Slider: { trackBg: '#0066FF', trackHoverBg: '#0052cc', handleColor: '#0066FF' },
  },
};
