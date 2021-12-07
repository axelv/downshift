/* eslint-disable max-statements */
import { useRef, useEffect, useCallback, useMemo } from 'react'
import { isReactNative } from '../../is.macro'
import { handleRefs, normalizeArrowKey, callAllEventHandlers } from '../../utils'
import {
  getItemIndex,
  useA11yMessageSetter,
  useMouseAndTouchTracker,
  useGetterPropsCalledChecker,
  useLatestRef,
  useScrollIntoView,
  useControlPropsValidator,
  useElementIds,
} from '../utils'
import {
  getInitialState,
  defaultProps,
  useControlledReducer,
  validatePropTypes,
} from './utils'
import downshiftuseSlateSuggestReducer from './reducer'
import * as stateChangeTypes from './stateChangeTypes'

useSlateSuggest.stateChangeTypes = stateChangeTypes

function useSlateSuggest(userProps = {}) {
  validatePropTypes(userProps, useSlateSuggest)
  // Props defaults and destructuring.
  const props = {
    ...defaultProps,
    ...userProps,
  }
  const {
    initialIsOpen,
    defaultIsOpen,
    items,
    scrollIntoView,
    environment,
    getA11yStatusMessage,
    getA11ySelectionMessage,
    itemToString,
    focusEditor 
  } = props
  // Initial state depending on controlled props.
  const initialState = getInitialState(props)
  const [state, dispatch] = useControlledReducer(
    downshiftuseSlateSuggestReducer,
    initialState,
    props,
  )
  const { isOpen, highlightedIndex, selectedItem, inputValue } = state

  // Element refs.
  const menuRef = useRef(null)
  const itemRefs = useRef({})
  const inputRef = useRef(null)
  const toggleButtonRef = useRef(null)
  const comboboxRef = useRef(null)
  const isInitialMountRef = useRef(true)
  // prevent id re-generation between renders.
  const elementIds = useElementIds(props)
  // used to keep track of how many items we had on previous cycle.
  const previousResultCountRef = useRef()
  // utility callback to get item element.
  const latest = useLatestRef({ state, props })

  const getItemNodeFromIndex = useCallback(
    index => itemRefs.current[elementIds.getItemId(index)],
    [elementIds],
  )

  // Effects.
  // Sets a11y status message on changes in state.
  useA11yMessageSetter(
    getA11yStatusMessage,
    [isOpen, highlightedIndex, inputValue, items],
    {
      isInitialMount: isInitialMountRef.current,
      previousResultCount: previousResultCountRef.current,
      items,
      environment,
      itemToString,
      ...state,
    },
  )
  // Sets a11y status message on changes in selectedItem.
  useA11yMessageSetter(getA11ySelectionMessage, [selectedItem], {
    isInitialMount: isInitialMountRef.current,
    previousResultCount: previousResultCountRef.current,
    items,
    environment,
    itemToString,
    ...state,
  })
  // Scroll on highlighted item if change comes from keyboard.
  const shouldScrollRef = useScrollIntoView({
    menuElement: menuRef.current,
    highlightedIndex,
    isOpen,
    itemRefs,
    scrollIntoView,
    getItemNodeFromIndex,
  })
  useControlPropsValidator({
    isInitialMount: isInitialMountRef.current,
    props,
    state,
  })
  // Focus the input on first render if required.
  useEffect(() => {
    const focusOnOpen = initialIsOpen || defaultIsOpen || isOpen

    if (focusOnOpen) {
      focusEditor() 
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (isInitialMountRef.current) {
      return
    }

    previousResultCountRef.current = items.length
  })
  // Add mouse/touch events to document.
  const mouseAndTouchTrackersRef = useMouseAndTouchTracker(
    isOpen,
    [comboboxRef, menuRef, toggleButtonRef],
    environment,
    () => {
      dispatch({
        type: stateChangeTypes.InputBlur,
        selectItem: false,
      })
    },
  )
  const setGetterPropCallInfo = useGetterPropsCalledChecker(
    'getComboboxProps',
    'getMenuProps',
  )
  // Make initial ref false.
  useEffect(() => {
    isInitialMountRef.current = false
  }, [])
  // Reset itemRefs on close.
  useEffect(() => {
    if (!isOpen) {
      itemRefs.current = {}
    }
  }, [isOpen])

  /* Event handler functions */
  const inputKeyDownHandlers = useMemo(
    () => ({
      ArrowDown(event) {
        event.preventDefault()
        dispatch({
          type: stateChangeTypes.InputKeyDownArrowDown,
          shiftKey: event.shiftKey,
          getItemNodeFromIndex,
        })
      },
      ArrowUp(event) {
        event.preventDefault()
        dispatch({
          type: stateChangeTypes.InputKeyDownArrowUp,
          shiftKey: event.shiftKey,
          getItemNodeFromIndex,
        })
      },
      Home(event) {
        if (!latest.current.state.isOpen) {
          return
        }

        event.preventDefault()
        dispatch({
          type: stateChangeTypes.InputKeyDownHome,
          getItemNodeFromIndex,
        })
      },
      End(event) {
        if (!latest.current.state.isOpen) {
          return
        }

        event.preventDefault()
        dispatch({
          type: stateChangeTypes.InputKeyDownEnd,
          getItemNodeFromIndex,
        })
      },
      Escape() {
        const latestState = latest.current.state
        if (
          latestState.isOpen ||
          latestState.inputValue ||
          latestState.selectedItem ||
          latestState.highlightedIndex > -1
        ) {
          dispatch({
            type: stateChangeTypes.InputKeyDownEscape,
          })
        }
      },
      Enter(event) {
        const latestState = latest.current.state
        // if closed or no highlighted index, do nothing.
        if (
          !latestState.isOpen ||
          latestState.highlightedIndex < 0 ||
          event.which === 229 // if IME composing, wait for next Enter keydown event.
        ) {
          return
        }

        event.preventDefault()
        dispatch({
          type: stateChangeTypes.InputKeyDownEnter,
          getItemNodeFromIndex,
        })
      },
    }),
    [dispatch, latest, getItemNodeFromIndex],
  )

  // Getter props.
  const getLabelProps = useCallback(
    labelProps => ({
      id: elementIds.labelId,
      htmlFor: elementIds.inputId,
      ...labelProps,
    }),
    [elementIds],
  )
  const getMenuProps = useCallback(
    (
      { onMouseLeave, refKey = 'ref', ref, ...rest } = {},
      { suppressRefError = false } = {},
    ) => {
      setGetterPropCallInfo('getMenuProps', suppressRefError, refKey, menuRef)
      return {
        [refKey]: handleRefs(ref, menuNode => {
          menuRef.current = menuNode
        }),
        id: elementIds.menuId,
        role: 'listbox',
        'aria-labelledby': elementIds.labelId,
        onMouseLeave: callAllEventHandlers(onMouseLeave, () => {
          dispatch({
            type: stateChangeTypes.MenuMouseLeave,
          })
        }),
        ...rest,
      }
    },
    [dispatch, setGetterPropCallInfo, elementIds],
  )

  const getItemProps = useCallback(
    ({
      item,
      index,
      refKey = 'ref',
      ref,
      onMouseMove,
      onClick,
      onPress,
      ...rest
    } = {}) => {
      const { props: latestProps, state: latestState } = latest.current
      const itemIndex = getItemIndex(index, item, latestProps.items)
      if (itemIndex < 0) {
        throw new Error('Pass either item or item index in getItemProps!')
      }

      const onSelectKey = isReactNative
        ? /* istanbul ignore next (react-native) */ 'onPress'
        : 'onClick'
      const customClickHandler = isReactNative
        ? /* istanbul ignore next (react-native) */ onPress
        : onClick

      const itemHandleMouseMove = () => {
        if (index === latestState.highlightedIndex) {
          return
        }
        shouldScrollRef.current = false
        dispatch({
          type: stateChangeTypes.ItemMouseMove,
          index,
        })
      }
      const itemHandleClick = () => {
        dispatch({
          type: stateChangeTypes.ItemClick,
          index,
        })

        focusEditor() 
      }

      return {
        [refKey]: handleRefs(ref, itemNode => {
          if (itemNode) {
            itemRefs.current[elementIds.getItemId(itemIndex)] = itemNode
          }
        }),
        role: 'option',
        'aria-selected': `${itemIndex === latestState.highlightedIndex}`,
        id: elementIds.getItemId(itemIndex),
        ...(!rest.disabled && {
          onMouseMove: callAllEventHandlers(onMouseMove, itemHandleMouseMove),
          [onSelectKey]: callAllEventHandlers(
            customClickHandler,
            itemHandleClick,
          ),
        }),
        ...rest,
      }
    },
    [dispatch, latest, shouldScrollRef, elementIds],
  )

  const getToggleButtonProps = useCallback(
    ({ onClick, onPress, refKey = 'ref', ref, ...rest } = {}) => {
      const toggleButtonHandleClick = () => {
        dispatch({
          type: stateChangeTypes.ToggleButtonClick,
        })

        if (!latest.current.state.isOpen) {
          focusEditor()
        }
      }

      return {
        [refKey]: handleRefs(ref, toggleButtonNode => {
          toggleButtonRef.current = toggleButtonNode
        }),
        id: elementIds.toggleButtonId,
        tabIndex: -1,
        ...(!rest.disabled && {
          ...(isReactNative
            ? /* istanbul ignore next (react-native) */ {
              onPress: callAllEventHandlers(onPress, toggleButtonHandleClick),
            }
            : {
              onClick: callAllEventHandlers(onClick, toggleButtonHandleClick),
            }),
        }),
        ...rest,
      }
    },
    [dispatch, latest, elementIds],
  )
  const getInputProps = useCallback(
    (
      {
        onKeyDown,
        onBlur,
        refKey= 'ref',
        ...rest
      } = {},
      {suppressRefError=false}={}
    ) => {
      setGetterPropCallInfo('getInputProps', suppressRefError, refKey, inputRef)

      const latestState = latest.current.state
      const inputHandleKeyDown = event => {
        const key = normalizeArrowKey(event)
        if (key && inputKeyDownHandlers[key]) {
          inputKeyDownHandlers[key](event)
        }
      }

      const inputHandleBlur = () => {
        /* istanbul ignore else */
        if (latestState.isOpen && !mouseAndTouchTrackersRef.current.isMouseDown) {
          dispatch({
            type: stateChangeTypes.InputBlur,
            selectItem: true,
          })
        }
      }

      /* istanbul ignore next (preact) */
      let eventHandlers = {}

      if (!rest.disabled) {
        eventHandlers = {
          onKeyDown: callAllEventHandlers(inputHandleKeyDown, onKeyDown),
          onBlur: callAllEventHandlers(inputHandleBlur, onBlur),
        }
      }

      return { 
        id: elementIds.inputId,
        'aria-autocomplete': 'list',
        'aria-controls': elementIds.menuId,
        ...(latestState.isOpen &&
          latestState.highlightedIndex > -1 && {
          'aria-activedescendant': elementIds.getItemId(
            latestState.highlightedIndex,
          ),
        }),
        'aria-labelledby': elementIds.labelId,
        // https://developer.mozilla.org/en-US/docs/Web/Security/Securing_your_site/Turning_off_form_autocompletion
        // revert back since autocomplete="nope" is ignored on latest Chrome and Opera
        autoComplete: 'off',
        ...eventHandlers,
        ...rest,
      }
    },
    [
      dispatch,
      inputKeyDownHandlers,
      latest,
      mouseAndTouchTrackersRef,
      setGetterPropCallInfo,
      elementIds,
    ],
  )
  const getComboboxProps = useCallback(
    ({ refKey = 'ref', ref, ...rest } = {}, { suppressRefError = true } = {}) => {
      setGetterPropCallInfo(
        'getComboboxProps',
        suppressRefError,
        refKey,
        comboboxRef,
      )

      return {
        [refKey]: handleRefs(ref, comboboxNode => {
          comboboxRef.current = comboboxNode
        }),
        role: 'combobox',
        'aria-haspopup': 'listbox',
        'aria-owns': elementIds.menuId,
        'aria-expanded': latest.current.state.isOpen,
        ...rest,
      }
    },
    [latest, setGetterPropCallInfo, elementIds],
  )

  // returns
  const toggleMenu = useCallback(() => {
    dispatch({
      type: stateChangeTypes.FunctionToggleMenu,
    })
  }, [dispatch])
  const closeMenu = useCallback(() => {
    dispatch({
      type: stateChangeTypes.FunctionCloseMenu,
    })
  }, [dispatch])
  const openMenu = useCallback(() => {
    dispatch({
      type: stateChangeTypes.FunctionOpenMenu,
    })
  }, [dispatch])
  const setHighlightedIndex = useCallback(
    newHighlightedIndex => {
      dispatch({
        type: stateChangeTypes.FunctionSetHighlightedIndex,
        highlightedIndex: newHighlightedIndex,
      })
    },
    [dispatch],
  )
  const selectItem = useCallback(
    newSelectedItem => {
      dispatch({
        type: stateChangeTypes.FunctionSelectItem,
        selectedItem: newSelectedItem,
      })
    },
    [dispatch],
  )

  const reset = useCallback(() => {
    dispatch({
      type: stateChangeTypes.FunctionReset,
    })
  }, [dispatch])

  return {
    // prop getters.
    getItemProps,
    getLabelProps,
    getMenuProps,
    getInputProps,
    getComboboxProps,
    getToggleButtonProps,
    // actions.
    toggleMenu,
    openMenu,
    closeMenu,
    setHighlightedIndex,
    selectItem,
    reset,
    // state.
    highlightedIndex,
    isOpen,
    selectedItem,
    inputValue,
  }
}

export default useSlateSuggest
