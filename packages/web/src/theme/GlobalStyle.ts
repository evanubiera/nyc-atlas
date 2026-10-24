import { createGlobalStyle } from 'styled-components';

export const GlobalStyle = createGlobalStyle`
  *, *::before, *::after { box-sizing: border-box; }

  html, body, #root {
    height: 100%;
    margin: 0;
  }

  body {
    background: ${({ theme }) => theme.pagePlane};
    color: ${({ theme }) => theme.textPrimary};
    font-family: ${({ theme }) => theme.font};
    -webkit-font-smoothing: antialiased;
  }

  :focus-visible {
    outline: 2px solid ${({ theme }) => theme.series[0]};
    outline-offset: 2px;
  }

  /* specs/006: disable camera animation and extrusion transitions. */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
`;
