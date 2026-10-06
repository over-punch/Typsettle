// settle/src/react/SettleText.tsx — React component wrapper
import React, { Children, forwardRef, isValidElement, useCallback, useEffect } from 'react'
import { useSettle } from './useSettle'
import type { SettleOptions } from '../core/types'

interface SettleTextProps extends SettleOptions, Omit<React.HTMLAttributes<HTMLElement>, 'children' | 'className' | 'style'> {
	children: React.ReactNode
	className?: string
	style?: React.CSSProperties
	as?: React.ElementType
	/** Called once on mount with a replay function the parent can invoke to re-trigger the animation */
	onReady?: (replay: () => void) => void
}

/**
 * Drop-in component that applies the settle effect to its children.
 * Forwards the ref to the root DOM element while also wiring the internal settle ref.
 * Accepts an onReady prop to expose the replay() imperative handle to the parent.
 */
/** SettleOptions keys: consumed by the hook, not forwarded to the DOM element. */
const OPTION_KEYS: (keyof SettleOptions)[] = [
	'lineDetection', 'spread', 'duration', 'easing', 'stagger', 'active', 'targetTracking', 'direction', 'intersect', 'quietReplay',
]

/**
 * A string that changes whenever the rendered content of `children` changes: text, element types,
 * keys and primitive props, walked recursively. Functions and objects are ignored.
 */
function childrenSignature(children: React.ReactNode): string {
	const parts: string[] = []
	const walk = (node: React.ReactNode) => {
		Children.forEach(node, (child) => {
			if (child === null || child === undefined || typeof child === 'boolean') return
			if (typeof child === 'string' || typeof child === 'number') { parts.push(String(child)); return }
			if (isValidElement(child)) {
				const type = typeof child.type === 'string' ? child.type : ((child.type as { displayName?: string; name?: string }).displayName ?? (child.type as { name?: string }).name ?? 'C')
				const props = child.props as Record<string, unknown>
				const attrs = Object.keys(props).filter((k) => k !== 'children' && ['string', 'number', 'boolean'].includes(typeof props[k])).sort().map((k) => `${k}=${String(props[k])}`)
				parts.push(`<${type}${child.key != null ? '#' + child.key : ''} ${attrs.join(' ')}>`)
				walk(props.children as React.ReactNode)
				parts.push(`</${type}>`)
			}
		})
	}
	walk(children)
	return parts.join('\u0000')
}

export const SettleText = forwardRef<HTMLElement, SettleTextProps>(
	function SettleText({ children, className, style, as: Tag = 'p', onReady, ...rest }, forwardedRef) {
		// Algorithm options go to the hook; everything else (id, aria-*, data-*, lang, events…) to the element.
		const options: SettleOptions = {}
		const htmlProps: Record<string, unknown> = {}
		for (const [key, value] of Object.entries(rest)) {
			if ((OPTION_KEYS as string[]).includes(key)) (options as Record<string, unknown>)[key] = value
			else htmlProps[key] = value
		}
		// The library rebuilds the element's DOM, so React can't patch new children into it. When the
		// children or the tag change, remount the element (key) and re-run on the fresh content.
		const contentKey = `${typeof Tag === 'string' ? Tag : 'C'}|${childrenSignature(children)}`
		const { ref: innerRef, replay } = useSettle(options, contentKey)

		useEffect(() => {
			if (onReady) onReady(replay)
		// onReady is intentionally excluded — callers should stabilise it with useCallback
		// eslint-disable-next-line react-hooks/exhaustive-deps
		}, [replay])

		/** Merged ref callback — satisfies both the internal hook ref and any forwarded ref. */
		const mergedRef = useCallback(
			(node: HTMLElement | null) => {
				// Write to the inner mutable ref used by useSettle
				;(innerRef as React.MutableRefObject<HTMLElement | null>).current = node
				// Forward to the caller's ref (callback or object)
				if (typeof forwardedRef === 'function') {
					forwardedRef(node)
				} else if (forwardedRef) {
					forwardedRef.current = node
				}
			},
			// eslint-disable-next-line react-hooks/exhaustive-deps
			[innerRef, forwardedRef],
		)

		return (
			<Tag key={contentKey} ref={mergedRef as React.Ref<HTMLElement>} className={className} style={style} {...htmlProps}>
				{children}
			</Tag>
		)
	},
)

SettleText.displayName = 'SettleText'
