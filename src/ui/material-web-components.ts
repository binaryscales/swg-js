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

import {OutlinedButton} from '@material/web/button/internal/outlined-button.js';
import {css} from 'lit';
import {styles as outlinedStyles} from '@material/web/button/internal/outlined-styles.cssresult.js';
import {styles as sharedStyles} from '@material/web/button/internal/shared-styles.cssresult.js';

export class SwgOutlinedButton extends OutlinedButton {}

SwgOutlinedButton.styles = [
  sharedStyles,
  outlinedStyles,
  css`
    :host {
      --_container-color: var(--md-outlined-button-container-color, transparent);
      background-color: var(--md-outlined-button-container-color, transparent);
      border-radius: var(--_container-shape-start-start);
      vertical-align: middle;
      box-sizing: border-box;
      min-height: var(--_container-height, 40px);
    }
    :host(:is([disabled],[soft-disabled])) {
      --_container-color: var(--md-outlined-button-disabled-container-color, transparent);
      background-color: var(--md-outlined-button-disabled-container-color, transparent);
    }
    .outline {
      z-index: 1;
      pointer-events: none;
    }
  `,
];

export const SWG_OUTLINED_BUTTON_TAG = 'swg-md-outlined-button';

/**
 * Safely registers the custom element in customElements if not already defined.
 */
export function defineSwgMaterialElements() {
  if (
    typeof customElements !== 'undefined' &&
    !customElements.get(SWG_OUTLINED_BUTTON_TAG)
  ) {
    customElements.define(SWG_OUTLINED_BUTTON_TAG, SwgOutlinedButton);
  }
}
