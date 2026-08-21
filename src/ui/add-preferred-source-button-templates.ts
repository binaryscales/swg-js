/**
 * Copyright 2026 The Subscribe with Google Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const css = String.raw;

const LIGHT_THEME = {
  containerColor: '#ffffff',
  outlineColor: '#c4c7c5',
  textColor: '#1f1f1f',
  disabledContainerColor: '#e1e3e1',
  disabledOutlineColor: '#e1e3e1',
  disabledTextColor: '#747775',
};

const DARK_THEME = {
  containerColor: '#131314',
  outlineColor: '#444746',
  textColor: '#e3e3e3',
  disabledContainerColor: '#444746',
  disabledOutlineColor: '#444746',
  disabledTextColor: '#8e918f',
};

function renderThemeTokens(theme: typeof LIGHT_THEME): string {
  return css`
    --md-outlined-button-outline-width: 1px;
    --md-outlined-button-outline-color: ${theme.outlineColor};
    --md-outlined-button-container-color: ${theme.containerColor};
    --md-outlined-button-disabled-container-color: ${theme.disabledContainerColor};
    --md-outlined-button-disabled-outline-color: ${theme.disabledOutlineColor};
    --md-outlined-button-disabled-outline-opacity: 1;
    --md-outlined-button-disabled-label-text-color: ${theme.disabledTextColor};
    --md-outlined-button-disabled-label-text-opacity: 1;
    --md-outlined-button-disabled-icon-opacity: 0.38;
    --md-outlined-button-label-text-color: ${theme.textColor};
    --md-outlined-button-hover-label-text-color: ${theme.textColor};
    --md-outlined-button-pressed-label-text-color: ${theme.textColor};
    --md-outlined-button-focus-label-text-color: ${theme.textColor};
    --md-outlined-button-hover-state-layer-color: ${theme.textColor};
    --md-outlined-button-pressed-state-layer-color: ${theme.textColor};
  `;
}

/**
 * Generates the encapsulated Shadow DOM CSS rules.
 */
export function getButtonStyles(
  themeOption?: 'light' | 'dark' | 'auto' | boolean
): string {
  const isDark = themeOption === 'dark' || themeOption === true;
  const isLight = themeOption === 'light' || themeOption === false;
  const isAuto = !isDark && !isLight;

  const baseTheme = isDark ? DARK_THEME : LIGHT_THEME;

  const autoDarkMedia = isAuto
    ? css`
        @media (prefers-color-scheme: dark) {
          :host {
            ${renderThemeTokens(DARK_THEME)}
          }
          swg-md-outlined-button {
            background-color: ${DARK_THEME.containerColor};
          }
          swg-md-outlined-button[disabled],
          swg-md-outlined-button[aria-disabled='true'] {
            background-color: ${DARK_THEME.disabledContainerColor};
          }
        }
      `
    : '';

  return css`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      vertical-align: middle;
      box-sizing: border-box;
      line-height: normal;

      ${renderThemeTokens(baseTheme)}

      --md-outlined-button-label-text-font: 'Google Sans Text', Roboto, Helvetica, Arial, sans-serif;
      --md-outlined-button-label-text-size: 14px;
      --md-outlined-button-label-text-weight: 500;
      --md-outlined-button-container-shape: 100px;
      --md-outlined-button-with-leading-icon-leading-space: 14px;
      --md-outlined-button-with-leading-icon-trailing-space: 16px;
      --md-outlined-button-container-height: 40px;
      --md-outlined-button-icon-size: 22px;
    }
    swg-md-outlined-button {
      display: inline-flex;
      vertical-align: middle;
      box-sizing: border-box;
      min-height: 40px;
      font-family: 'Google Sans Text', Roboto, Helvetica, Arial, sans-serif;
      white-space: nowrap;
      background-color: ${baseTheme.containerColor};
      border-radius: 100px;
    }
    swg-md-outlined-button[disabled],
    swg-md-outlined-button[aria-disabled='true'] {
      background-color: ${baseTheme.disabledContainerColor};
      cursor: default;
      pointer-events: none;
    }
    .publisher-logo {
      width: 22px;
      height: 22px;
      flex-shrink: 0;
      display: inline-block;
      vertical-align: middle;
      object-fit: contain;
    }
    .publisher-btn-text {
      line-height: 20px;
    }
    ${autoDarkMedia}
  `;
}
