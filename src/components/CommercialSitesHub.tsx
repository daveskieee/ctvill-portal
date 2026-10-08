/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import ProjectProfileHub, { 
  AVAILABLE_PMS, 
  calculateProjectProgress, 
  getEffectiveProjectStatus 
} from './ProjectProfileHub';

export { AVAILABLE_PMS, calculateProjectProgress, getEffectiveProjectStatus };
export const CommercialSitesHub = ProjectProfileHub;
export default ProjectProfileHub;
