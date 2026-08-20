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
      display: inline-block;
      vertical-align: middle;
      box-sizing: border-box;
      line-height: normal;
    }
    .swg-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      min-height: 40px;
      padding-block: 9px;
      padding-inline: 14px 16px;
      gap: 8px;
      border-radius: 100px;
      font-family: 'Google Sans Text', Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px;
      font-weight: 500;
      letter-spacing: 0.1px;
      cursor: pointer;
      white-space: nowrap;
      user-select: none;
      -webkit-user-select: none;
      outline: none;
      text-decoration: none;
      border: 1px solid ${isDark ? '#5f6368' : '#c4c7c5'};
      background-color: ${isDark ? '#202124' : '#ffffff'};
      color: ${isDark ? '#e8eaed' : '#1f1f1f'};
      transition:
        background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1),
        box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1),
        border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .swg-btn:hover:not([aria-disabled='true']) {
      background-color: ${isDark ? '#303134' : '#f8f9fa'};
      box-shadow: ${isDark
        ? '0 1px 2px 0 rgba(0, 0, 0, 0.3)'
        : '0 1px 2px 0 rgba(60, 64, 67, 0.3), 0 1px 3px 1px rgba(60, 64, 67, 0.15)'};
    }
    .swg-btn:focus-visible:not([aria-disabled='true']) {
      background-color: ${isDark ? '#35363a' : '#f1f3f4'};
      box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.4);
    }
    .swg-btn:active:not([aria-disabled='true']) {
      background-color: ${isDark ? '#37393b' : '#f1f3f4'};
    }
    .swg-btn[aria-disabled='true'] {
      color: ${isDark ? '#80868b' : '#747775'};
      background-color: ${isDark ? '#202124' : '#e1e3e1'};
      border-color: ${isDark ? '#3c4043' : '#e1e3e1'};
      cursor: default;
      box-shadow: none;
      pointer-events: none;
    }
    .swg-logo {
      width: 22px;
      height: 22px;
      flex-shrink: 0;
      display: inline-block;
      vertical-align: middle;
    }
    .swg-btn-text {
      line-height: 20px;
    }
  `;
}
