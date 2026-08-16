import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

// Returns the on-screen keyboard height, or 0 when it's closed.
//
// KeyboardAvoidingView is unreliable inside an Android <Modal>: the modal is
// its own window, so the system's adjustResize never shrinks it and the sheet
// stays pinned under the keyboard. Measuring the keyboard and padding the
// sheet by that much works the same way on both platforms.
export function useKeyboardHeight() {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    // iOS fires the "will" events with the animation, so the sheet moves in
    // step with the keyboard instead of snapping after it lands.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = Keyboard.addListener(showEvent, (e) =>
      setHeight(e?.endCoordinates?.height ?? 0)
    );
    const onHide = Keyboard.addListener(hideEvent, () => setHeight(0));

    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);

  return height;
}
