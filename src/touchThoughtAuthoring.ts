type Position = { x: number; y: number };

type ComposerPositionInput = {
  position: Position;
  layoutHeight: number;
  visualViewport?: { offsetTop: number; height: number };
};

const composerRadius = 105;
const composerMargin = 16;

type NavigatorIdentity = Pick<Navigator, 'maxTouchPoints' | 'platform' | 'userAgent'>;

export function isIOSDevice(navigatorObject: NavigatorIdentity) {
  return (
    /iPad|iPhone|iPod/.test(navigatorObject.userAgent) ||
    (navigatorObject.platform === 'MacIntel' && navigatorObject.maxTouchPoints > 1)
  );
}

export function shouldOpenThoughtImmediately(pointerKind: string, ios: boolean) {
  return ios && (pointerKind === 'touch' || pointerKind === 'pen');
}

export function composerPositionForKeyboard({
  position,
  layoutHeight,
  visualViewport,
}: ComposerPositionInput): Position {
  const viewportTop = visualViewport?.offsetTop ?? 0;
  const viewportHeight = visualViewport?.height ?? layoutHeight;
  const visibleBottom = viewportTop + viewportHeight;
  const minimumY = viewportTop + composerRadius + composerMargin;
  const maximumY = Math.max(
    minimumY,
    Math.floor(visibleBottom - composerRadius - composerMargin),
  );

  return { ...position, y: Math.min(position.y, maximumY) };
}
