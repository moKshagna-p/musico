import { useEvent } from 'expo'
import { useVideoPlayer, VideoView } from 'expo-video'
import { Platform, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useReducedMotion } from 'react-native-reanimated'

// Apple's looping motion hero (the web's HeroVideo in Billboard.jsx): muted, no controls, fading in over the still
// once it actually plays. Reduce Motion gets the still only.
export const HeroVideo = ({ src, style }: { src?: string | null; style?: StyleProp<ViewStyle> }) => {
  const still = useReducedMotion()
  return src && !still ? <Player src={src} style={style} /> : null
}

const Player = ({ src, style }: { src: string; style?: StyleProp<ViewStyle> }) => {
  const player = useVideoPlayer(src, (p) => {
    p.loop = true
    p.muted = true
    p.play()
  })
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing })
  return (
    // Reanimated CSS transition on the wrapper, since VideoView itself isn't animatable.
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style, { opacity: isPlaying ? 1 : 0, transitionProperty: 'opacity', transitionDuration: 1000 }]}>
      <VideoView
        player={player}
        nativeControls={false}
        contentFit="cover"
        // Android's default SurfaceView ignores its parent's opacity, so the fade needs a TextureView.
        surfaceType={Platform.OS === 'android' ? 'textureView' : undefined}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  )
}
