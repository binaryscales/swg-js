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

/**
 * Generates the encapsulated Shadow DOM CSS rules.
 */
export function getButtonStyles(isDark: boolean): string {
  return css`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      vertical-align: middle;
      box-sizing: border-box;
      line-height: normal;

      --md-outlined-button-outline-width: 1px;
      --md-outlined-button-outline-color: ${isDark ? '#444746' : '#c4c7c5'};
      --md-outlined-button-container-color: ${isDark ? '#131314' : '#ffffff'};
      --md-outlined-button-disabled-container-color: ${isDark ? '#444746' : '#e1e3e1'};
      --md-outlined-button-disabled-outline-color: ${isDark ? '#444746' : '#e1e3e1'};
      --md-outlined-button-disabled-outline-opacity: 1;
      --md-outlined-button-disabled-label-text-color: ${isDark ? '#8e918f' : '#747775'};
      --md-outlined-button-disabled-label-text-opacity: 1;
      --md-outlined-button-disabled-icon-opacity: 0.38;
      --md-outlined-button-label-text-color: ${isDark ? '#e3e3e3' : '#1f1f1f'};
      --md-outlined-button-hover-label-text-color: ${isDark ? '#e3e3e3' : '#1f1f1f'};
      --md-outlined-button-pressed-label-text-color: ${isDark ? '#e3e3e3' : '#1f1f1f'};
      --md-outlined-button-focus-label-text-color: ${isDark ? '#e3e3e3' : '#1f1f1f'};
      --md-outlined-button-hover-state-layer-color: ${isDark ? '#e3e3e3' : '#1f1f1f'};
      --md-outlined-button-pressed-state-layer-color: ${isDark ? '#e3e3e3' : '#1f1f1f'};
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
      height: 40px;
      font-family: 'Google Sans Text', Roboto, Helvetica, Arial, sans-serif;
      white-space: nowrap;
      background-color: ${isDark ? '#131314' : '#ffffff'};
      border-radius: 100px;
    }
    swg-md-outlined-button[disabled],
    swg-md-outlined-button[aria-disabled='true'] {
      background-color: ${isDark ? '#444746' : '#e1e3e1'};
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
  `;
}
