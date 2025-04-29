import '../css/global.css';
import '../scss/global.scss';

import SceneRenderer from './Scene';

document.addEventListener('DOMContentLoaded', () => {});

window.addEventListener('load', () => {
  const canvas = document.querySelector('#canvas');

  if (canvas) {
    new SceneRenderer(document.querySelector('#canvas'));
  }
});
