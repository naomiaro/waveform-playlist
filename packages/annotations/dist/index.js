"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  Annotation: () => Annotation,
  AnnotationBox: () => AnnotationBox,
  AnnotationBoxesWrapper: () => AnnotationBoxesWrapper,
  AnnotationText: () => AnnotationText2,
  AnnotationsTrack: () => AnnotationsTrack,
  ContinuousPlayCheckbox: () => ContinuousPlayCheckbox,
  DownloadAnnotationsButton: () => DownloadAnnotationsButton,
  EditableCheckbox: () => EditableCheckbox,
  LinkEndpointsCheckbox: () => LinkEndpointsCheckbox,
  parseAeneas: () => parseAeneas,
  serializeAeneas: () => serializeAeneas,
  useAnnotationControls: () => useAnnotationControls
});
module.exports = __toCommonJS(index_exports);

// src/parsers/aeneas.ts
function parseAeneas(data) {
  return {
    id: data.id,
    start: parseFloat(data.begin),
    end: parseFloat(data.end),
    lines: data.lines,
    lang: data.language
  };
}
function serializeAeneas(annotation) {
  return {
    id: annotation.id,
    begin: annotation.start.toFixed(3),
    end: annotation.end.toFixed(3),
    lines: annotation.lines,
    language: annotation.lang || "en"
  };
}

// src/components/Annotation.tsx
var import_react = require("react");
var import_styled_components = __toESM(require("styled-components"));
var import_jsx_runtime = require("react/jsx-runtime");
var AnnotationOverlay = import_styled_components.default.div.attrs((props) => ({
  style: {
    left: `${props.$left}px`,
    width: `${props.$width}px`
  }
}))`
  position: absolute;
  top: 0;
  background: ${(props) => props.$color};
  height: 100%;
  z-index: 10;
  pointer-events: auto;
  opacity: 0.3;
  border: 2px solid ${(props) => props.$color};
  border-radius: 4px;
  cursor: pointer;

  &:hover {
    opacity: 0.5;
    border-color: ${(props) => props.$color};
  }
`;
var AnnotationText = import_styled_components.default.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 4px 8px;
  font-size: 12px;
  line-height: 1.3;
  max-height: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
  white-space: pre-wrap;
  word-break: break-word;
`;
var EditableText = import_styled_components.default.textarea`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 4px 8px;
  font-size: 12px;
  line-height: 1.3;
  max-height: 60%;
  overflow: auto;
  border: 1px solid #fff;
  resize: none;
  font-family: inherit;

  &:focus {
    outline: none;
    border-color: #4CAF50;
  }
`;
var ControlsBar = import_styled_components.default.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  gap: 4px;
  padding: 4px;
  justify-content: flex-start;
  align-items: center;
`;
var ControlButton = import_styled_components.default.button`
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.5);
  color: white;
  padding: 4px 8px;
  font-size: 10px;
  cursor: pointer;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: white;
  }

  &:active {
    background: rgba(255, 255, 255, 0.3);
  }
`;
var Annotation = ({
  annotation,
  index,
  allAnnotations,
  startPosition,
  endPosition,
  color = "#ff9800",
  editable = false,
  controls = [],
  onAnnotationUpdate,
  annotationListConfig,
  onClick
}) => {
  const [isEditing, setIsEditing] = (0, import_react.useState)(false);
  const [editedText, setEditedText] = (0, import_react.useState)(annotation.lines.join("\n"));
  const width = Math.max(0, endPosition - startPosition);
  if (width <= 0) {
    return null;
  }
  const handleClick = () => {
    if (onClick) {
      onClick(annotation);
    }
  };
  const handleDoubleClick = () => {
    if (editable) {
      setIsEditing(true);
    }
  };
  const handleTextChange = (e) => {
    setEditedText(e.target.value);
  };
  const handleTextBlur = () => {
    setIsEditing(false);
    const newLines = editedText.split("\n");
    if (newLines.join("\n") !== annotation.lines.join("\n")) {
      const updatedAnnotations = [...allAnnotations];
      updatedAnnotations[index] = { ...annotation, lines: newLines };
      if (onAnnotationUpdate) {
        onAnnotationUpdate(updatedAnnotations);
      }
    }
  };
  const handleControlClick = (control) => {
    const annotationsCopy = [...allAnnotations];
    control.action(annotationsCopy[index], index, annotationsCopy, annotationListConfig || {});
    if (onAnnotationUpdate) {
      onAnnotationUpdate(annotationsCopy);
    }
  };
  const getIconClass = (classString) => {
    return classString.replace(/\./g, " ");
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    AnnotationOverlay,
    {
      $left: startPosition,
      $width: width,
      $color: color,
      onClick: handleClick,
      onDoubleClick: handleDoubleClick,
      children: [
        controls.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ControlsBar, { children: controls.map((control, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          ControlButton,
          {
            title: control.title,
            onClick: (e) => {
              e.stopPropagation();
              handleControlClick(control);
            },
            children: control.text ? control.text : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { className: getIconClass(control.class || "") })
          },
          idx
        )) }),
        isEditing ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          EditableText,
          {
            value: editedText,
            onChange: handleTextChange,
            onBlur: handleTextBlur,
            autoFocus: true,
            onClick: (e) => e.stopPropagation(),
            onDoubleClick: (e) => e.stopPropagation()
          }
        ) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AnnotationText, { children: annotation.lines.join("\n") })
      ]
    }
  );
};

// src/components/AnnotationBox.tsx
var import_styled_components2 = __toESM(require("styled-components"));
var import_core = require("@dnd-kit/core");
var import_jsx_runtime2 = require("react/jsx-runtime");
var Wrapper = import_styled_components2.default.div.attrs((props) => ({
  style: {
    left: `${props.$left}px`,
    width: `${props.$width}px`
  }
}))`
  position: absolute;
  top: 0;
  height: 100%;
  pointer-events: none; /* Let events pass through to children */
`;
var Box = import_styled_components2.default.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 100%;
  background: ${(props) => props.$isActive ? props.theme?.annotationBoxActiveBackground || "rgba(255, 255, 255, 0.95)" : props.theme?.annotationBoxBackground || "rgba(255, 255, 255, 0.85)"};
  border: 2px solid ${(props) => props.$isActive ? props.theme?.annotationBoxActiveBorder || "#d67600" : props.$color};
  border-radius: 4px;
  cursor: pointer;
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);

  &:hover {
    background: ${(props) => props.theme?.annotationBoxHoverBackground || "rgba(255, 255, 255, 0.98)"};
    border-color: ${(props) => props.theme?.annotationBoxActiveBorder || "#d67600"};
    border-width: 3px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  }
`;
var Label = import_styled_components2.default.span`
  font-size: 12px;
  font-weight: 600;
  color: ${(props) => props.theme?.annotationLabelColor || "#2a2a2a"};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 6px;
  letter-spacing: 0.3px;
  user-select: none;
`;
var ResizeHandle = import_styled_components2.default.div`
  position: absolute;
  top: 0;
  ${(props) => props.$position === "left" ? "left: -8px" : "right: -8px"};
  width: 16px;
  height: 100%;
  cursor: ew-resize;
  z-index: 120; /* Above ClickOverlay (z-index: 100) and AnnotationBoxesWrapper (z-index: 110) */
  background: ${(props) => props.$isDragging ? props.theme?.annotationResizeHandleColor || "rgba(0, 0, 0, 0.2)" : "transparent"};
  border-radius: 4px;
  touch-action: none; /* Important for @dnd-kit on touch devices */
  pointer-events: auto;

  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 4px;
    height: 60%;
    background: ${(props) => props.$isDragging ? props.theme?.annotationResizeHandleActiveColor || "rgba(0, 0, 0, 0.8)" : props.theme?.annotationResizeHandleColor || "rgba(0, 0, 0, 0.4)"};
    border-radius: 2px;
    opacity: ${(props) => props.$isDragging ? 1 : 0.6};
    transition: opacity 0.2s, background 0.2s;
  }

  &:hover {
    background: ${(props) => props.theme?.annotationResizeHandleColor || "rgba(0, 0, 0, 0.1)"};
  }

  &:hover::before {
    opacity: 1;
    background: ${(props) => props.theme?.annotationResizeHandleActiveColor || "rgba(0, 0, 0, 0.7)"};
  }
`;
var AnnotationBox = ({
  annotationId,
  annotationIndex,
  startPosition,
  endPosition,
  label,
  color = "#ff9800",
  isActive = false,
  onClick,
  editable = true
}) => {
  const width = Math.max(0, endPosition - startPosition);
  const leftBoundaryId = `annotation-boundary-start-${annotationIndex}`;
  const {
    attributes: leftAttributes,
    listeners: leftListeners,
    setActivatorNodeRef: setLeftActivatorRef,
    isDragging: isLeftDragging
  } = (0, import_core.useDraggable)({
    id: leftBoundaryId,
    data: { annotationId, annotationIndex, edge: "start" },
    disabled: !editable
  });
  const rightBoundaryId = `annotation-boundary-end-${annotationIndex}`;
  const {
    attributes: rightAttributes,
    listeners: rightListeners,
    setActivatorNodeRef: setRightActivatorRef,
    isDragging: isRightDragging
  } = (0, import_core.useDraggable)({
    id: rightBoundaryId,
    data: { annotationId, annotationIndex, edge: "end" },
    disabled: !editable
  });
  if (width <= 0) {
    return null;
  }
  const createPointerDownHandler = (dndKitHandler) => {
    return (e) => {
      e.stopPropagation();
      dndKitHandler?.(e);
    };
  };
  const handleHandleClick = (e) => {
    e.stopPropagation();
  };
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(Wrapper, { $left: startPosition, $width: width, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      Box,
      {
        $color: color,
        $isActive: isActive,
        onClick,
        children: label && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Label, { children: label })
      }
    ),
    editable && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      ResizeHandle,
      {
        ref: setLeftActivatorRef,
        $position: "left",
        $isDragging: isLeftDragging,
        onClick: handleHandleClick,
        ...leftListeners,
        onPointerDown: createPointerDownHandler(leftListeners?.onPointerDown),
        ...leftAttributes
      }
    ),
    editable && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      ResizeHandle,
      {
        ref: setRightActivatorRef,
        $position: "right",
        $isDragging: isRightDragging,
        onClick: handleHandleClick,
        ...rightListeners,
        onPointerDown: createPointerDownHandler(rightListeners?.onPointerDown),
        ...rightAttributes
      }
    )
  ] });
};

// src/components/AnnotationBoxesWrapper.tsx
var import_styled_components3 = __toESM(require("styled-components"));
var import_ui_components = require("@waveform-playlist/ui-components");
var import_jsx_runtime3 = require("react/jsx-runtime");
var Container = import_styled_components3.default.div.attrs((props) => ({
  style: {
    height: `${props.$height}px`
  }
}))`
  position: relative;
  display: flex;
  ${(props) => props.$width !== void 0 && `width: ${props.$width}px;`}
  background: transparent;
  z-index: 110;
`;
var ControlsPlaceholder = import_styled_components3.default.div`
  position: sticky;
  z-index: 200;
  left: 0;
  height: 100%;
  width: ${(props) => props.$controlWidth}px;
  flex-shrink: 0;
  background: transparent;
`;
var BoxesContainer = import_styled_components3.default.div`
  position: relative;
  flex: 1;
  padding-left: ${(props) => props.$offset || 0}px;
`;
var AnnotationBoxesWrapper = ({
  children,
  className,
  height = 30,
  offset = 0,
  width
}) => {
  const {
    controls: { show, width: controlWidth }
  } = (0, import_ui_components.usePlaylistInfo)();
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
    Container,
    {
      className,
      $height: height,
      $controlWidth: show ? controlWidth : 0,
      $width: width,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ControlsPlaceholder, { $controlWidth: show ? controlWidth : 0 }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(BoxesContainer, { $offset: offset, children })
      ]
    }
  );
};

// src/components/AnnotationsTrack.tsx
var import_styled_components4 = __toESM(require("styled-components"));
var import_ui_components2 = require("@waveform-playlist/ui-components");
var import_jsx_runtime4 = require("react/jsx-runtime");
var Container2 = import_styled_components4.default.div.attrs((props) => ({
  style: {
    height: `${props.$height}px`
  }
}))`
  position: relative;
  display: flex;
  ${(props) => props.$width !== void 0 && `width: ${props.$width}px;`}
  background: transparent;
`;
var ControlsPlaceholder2 = import_styled_components4.default.div`
  position: sticky;
  z-index: 200;
  left: 0;
  height: 100%;
  width: ${(props) => props.$controlWidth}px;
  flex-shrink: 0;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: ${(props) => props.theme?.textColorMuted || "#666"};
  font-weight: bold;
`;
var AnnotationsContainer = import_styled_components4.default.div`
  position: relative;
  flex: 1;
  padding-left: ${(props) => props.$offset || 0}px;
`;
var AnnotationsTrack = ({
  children,
  className,
  height = 100,
  offset = 0,
  width
}) => {
  const {
    controls: { show, width: controlWidth }
  } = (0, import_ui_components2.usePlaylistInfo)();
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
    Container2,
    {
      className,
      $height: height,
      $controlWidth: show ? controlWidth : 0,
      $width: width,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ControlsPlaceholder2, { $controlWidth: show ? controlWidth : 0, children: "Annotations" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(AnnotationsContainer, { $offset: offset, children })
      ]
    }
  );
};

// src/components/AnnotationText.tsx
var import_react2 = __toESM(require("react"));
var import_styled_components5 = __toESM(require("styled-components"));
var import_jsx_runtime5 = require("react/jsx-runtime");
var Container3 = import_styled_components5.default.div`
  background: ${(props) => props.theme?.backgroundColor || "#fff"};
  ${(props) => props.$height ? `height: ${props.$height}px;` : "max-height: 200px;"}
  overflow-y: auto;
  padding: 8px;
`;
var AnnotationItem = import_styled_components5.default.div`
  padding: 12px;
  margin-bottom: 6px;
  border-left: 4px solid ${(props) => props.$isActive ? "#ff9800" : "transparent"};
  background: ${(props) => props.$isActive ? "rgba(255, 152, 0, 0.08)" : "transparent"};
  border-radius: 4px;
  transition: all 0.2s;
  cursor: pointer;
  box-shadow: ${(props) => props.$isActive ? "0 1px 3px rgba(255, 152, 0, 0.15)" : "none"};

  &:hover {
    background: ${(props) => props.$isActive ? "rgba(255, 152, 0, 0.12)" : props.theme?.annotationTextItemHoverBackground || "rgba(0, 0, 0, 0.03)"};
    border-left-color: ${(props) => props.$isActive ? "#ff9800" : props.theme?.borderColor || "#ddd"};
  }
`;
var AnnotationHeader = import_styled_components5.default.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
`;
var AnnotationInfo = import_styled_components5.default.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;
var AnnotationIdLabel = import_styled_components5.default.span`
  font-size: 11px;
  font-weight: 600;
  color: ${(props) => props.theme?.textColorMuted || "#666"};
  background: transparent;
  padding: 2px 6px;
  border-radius: 3px;
  min-width: 20px;
  outline: ${(props) => props.$isEditable ? `1px dashed ${props.theme?.borderColor || "#ddd"}` : "none"};

  &[contenteditable='true']:focus {
    outline: 2px solid #ff9800;
    background: rgba(255, 152, 0, 0.1);
  }
`;
var TimeRange = import_styled_components5.default.span`
  font-size: 12px;
  font-weight: 500;
  color: ${(props) => props.theme?.textColorMuted || "#555"};
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  letter-spacing: 0.5px;
`;
var AnnotationControls = import_styled_components5.default.div`
  display: flex;
  gap: 6px;
`;
var ControlButton2 = import_styled_components5.default.button`
  background: transparent;
  border: 1px solid ${(props) => props.theme?.borderColor || "#ccc"};
  color: ${(props) => props.theme?.textColor || "#333"};
  padding: 4px 8px;
  font-size: 14px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s ease;

  &:hover {
    background: ${(props) => props.theme?.buttonHoverBackground || "#e8e8e8"};
    border-color: ${(props) => props.theme?.inputFocusBorder || "#999"};
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.95);
  }
`;
var AnnotationTextContent = import_styled_components5.default.div`
  font-size: 14px;
  line-height: 1.6;
  color: ${(props) => props.theme?.textColor || "#2a2a2a"};
  white-space: pre-wrap;
  word-break: break-word;
  outline: ${(props) => props.$isEditable ? `1px dashed ${props.theme?.borderColor || "#ddd"}` : "none"};
  padding: ${(props) => props.$isEditable ? "6px" : "0"};
  border-radius: 3px;
  min-height: 20px;

  &[contenteditable='true']:focus {
    outline: 2px solid #ff9800;
    background: rgba(255, 152, 0, 0.1);
  }
`;
var AnnotationTextComponent = ({
  annotations,
  activeAnnotationId,
  shouldScrollToActive = false,
  editable = false,
  controls = [],
  annotationListConfig,
  height,
  onAnnotationClick,
  onAnnotationUpdate
}) => {
  const activeAnnotationRef = (0, import_react2.useRef)(null);
  const containerRef = (0, import_react2.useRef)(null);
  const prevActiveIdRef = (0, import_react2.useRef)(void 0);
  (0, import_react2.useEffect)(() => {
  });
  (0, import_react2.useEffect)(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleScroll = () => {
    };
    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);
  (0, import_react2.useEffect)(() => {
    if (activeAnnotationId && activeAnnotationRef.current && shouldScrollToActive) {
      activeAnnotationRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
      });
    }
    prevActiveIdRef.current = activeAnnotationId;
  }, [activeAnnotationId, shouldScrollToActive]);
  const formatTime = (seconds) => {
    if (isNaN(seconds) || !isFinite(seconds)) {
      return "0:00.000";
    }
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(3);
    return `${mins}:${secs.padStart(6, "0")}`;
  };
  const handleTextEdit = (index, newText) => {
    if (!editable || !onAnnotationUpdate) return;
    const updatedAnnotations = [...annotations];
    updatedAnnotations[index] = {
      ...updatedAnnotations[index],
      lines: newText.split("\n")
    };
    onAnnotationUpdate(updatedAnnotations);
  };
  const handleIdEdit = (index, newId) => {
    if (!editable || !onAnnotationUpdate) return;
    const trimmedId = newId.trim();
    if (!trimmedId) return;
    const updatedAnnotations = [...annotations];
    updatedAnnotations[index] = {
      ...updatedAnnotations[index],
      id: trimmedId
    };
    onAnnotationUpdate(updatedAnnotations);
  };
  const handleControlClick = (control, annotation, index) => {
    if (!onAnnotationUpdate) return;
    const annotationsCopy = [...annotations];
    control.action(annotationsCopy[index], index, annotationsCopy, annotationListConfig || {});
    onAnnotationUpdate(annotationsCopy);
  };
  const getIconClass = (classString) => {
    return classString.replace(/\./g, " ");
  };
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Container3, { ref: containerRef, $height: height, children: annotations.map((annotation, index) => {
    const isActive = annotation.id === activeAnnotationId;
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
      AnnotationItem,
      {
        ref: isActive ? activeAnnotationRef : null,
        $isActive: isActive,
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(AnnotationHeader, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(AnnotationInfo, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                AnnotationIdLabel,
                {
                  $isEditable: editable,
                  contentEditable: editable,
                  suppressContentEditableWarning: true,
                  onBlur: (e) => handleIdEdit(index, e.currentTarget.textContent || ""),
                  children: annotation.id
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(TimeRange, { children: [
                formatTime(annotation.start),
                " - ",
                formatTime(annotation.end)
              ] })
            ] }),
            controls.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(AnnotationControls, { onClick: (e) => e.stopPropagation(), children: controls.map((control, idx) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
              ControlButton2,
              {
                title: control.title,
                onClick: () => handleControlClick(control, annotation, index),
                children: control.text ? control.text : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("i", { className: getIconClass(control.class || "") })
              },
              idx
            )) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            AnnotationTextContent,
            {
              $isEditable: editable,
              contentEditable: editable,
              suppressContentEditableWarning: true,
              onBlur: (e) => handleTextEdit(index, e.currentTarget.textContent || ""),
              children: annotation.lines.join("\n")
            }
          )
        ]
      },
      annotation.id
    );
  }) });
};
var AnnotationText2 = import_react2.default.memo(AnnotationTextComponent);

// src/components/ContinuousPlayCheckbox.tsx
var import_ui_components3 = require("@waveform-playlist/ui-components");
var import_jsx_runtime6 = require("react/jsx-runtime");
var ContinuousPlayCheckbox = ({
  checked,
  onChange,
  disabled = false,
  className
}) => {
  const handleChange = (e) => {
    onChange(e.target.checked);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_ui_components3.BaseCheckboxWrapper, { className, children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      import_ui_components3.BaseCheckbox,
      {
        type: "checkbox",
        id: "continuous-play",
        className: "continuous-play",
        checked,
        onChange: handleChange,
        disabled
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_ui_components3.BaseCheckboxLabel, { htmlFor: "continuous-play", children: "Continuous Play" })
  ] });
};

// src/components/LinkEndpointsCheckbox.tsx
var import_ui_components4 = require("@waveform-playlist/ui-components");
var import_jsx_runtime7 = require("react/jsx-runtime");
var LinkEndpointsCheckbox = ({
  checked,
  onChange,
  disabled = false,
  className
}) => {
  const handleChange = (e) => {
    onChange(e.target.checked);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_ui_components4.BaseCheckboxWrapper, { className, children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      import_ui_components4.BaseCheckbox,
      {
        type: "checkbox",
        id: "link-endpoints",
        className: "link-endpoints",
        checked,
        onChange: handleChange,
        disabled
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_ui_components4.BaseCheckboxLabel, { htmlFor: "link-endpoints", children: "Link Endpoints" })
  ] });
};

// src/components/EditableCheckbox.tsx
var import_ui_components5 = require("@waveform-playlist/ui-components");
var import_jsx_runtime8 = require("react/jsx-runtime");
var EditableCheckbox = ({
  checked,
  onChange,
  className
}) => {
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_ui_components5.BaseCheckboxWrapper, { className, children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      import_ui_components5.BaseCheckbox,
      {
        type: "checkbox",
        id: "editable-annotations",
        checked,
        onChange: (e) => onChange(e.target.checked)
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_ui_components5.BaseCheckboxLabel, { htmlFor: "editable-annotations", children: "Editable Annotations" })
  ] });
};

// src/components/DownloadAnnotationsButton.tsx
var import_ui_components6 = require("@waveform-playlist/ui-components");
var import_jsx_runtime9 = require("react/jsx-runtime");
var DownloadAnnotationsButton = ({
  annotations,
  filename = "annotations.json",
  disabled = false,
  className,
  children = "Download JSON"
}) => {
  const handleDownload = () => {
    if (annotations.length === 0) {
      return;
    }
    const jsonData = annotations.map((annotation) => serializeAeneas(annotation));
    const jsonString = JSON.stringify(jsonData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
    import_ui_components6.BaseControlButton,
    {
      variant: "info",
      onClick: handleDownload,
      disabled: disabled || annotations.length === 0,
      className,
      title: annotations.length === 0 ? "No annotations to download" : "Download the annotations as JSON",
      children
    }
  );
};

// src/hooks/useAnnotationControls.ts
var import_react3 = require("react");
var LINK_THRESHOLD = 0.01;
var useAnnotationControls = (options = {}) => {
  const {
    initialContinuousPlay = false,
    initialLinkEndpoints = true
  } = options;
  const [continuousPlay, setContinuousPlay] = (0, import_react3.useState)(initialContinuousPlay);
  const [linkEndpoints, setLinkEndpoints] = (0, import_react3.useState)(initialLinkEndpoints);
  const updateAnnotationBoundaries = (0, import_react3.useCallback)(
    ({
      annotationIndex,
      newTime,
      isDraggingStart,
      annotations,
      duration,
      linkEndpoints: shouldLinkEndpoints
    }) => {
      const updatedAnnotations = [...annotations];
      const annotation = annotations[annotationIndex];
      if (isDraggingStart) {
        const constrainedStart = Math.min(annotation.end - 0.1, Math.max(0, newTime));
        const delta = constrainedStart - annotation.start;
        updatedAnnotations[annotationIndex] = {
          ...annotation,
          start: constrainedStart
        };
        if (shouldLinkEndpoints && annotationIndex > 0) {
          const prevAnnotation = updatedAnnotations[annotationIndex - 1];
          if (Math.abs(prevAnnotation.end - annotation.start) < LINK_THRESHOLD) {
            updatedAnnotations[annotationIndex - 1] = {
              ...prevAnnotation,
              end: Math.max(prevAnnotation.start + 0.1, prevAnnotation.end + delta)
            };
          } else if (constrainedStart <= prevAnnotation.end) {
            updatedAnnotations[annotationIndex] = {
              ...updatedAnnotations[annotationIndex],
              start: prevAnnotation.end
            };
          }
        } else if (!shouldLinkEndpoints && annotationIndex > 0 && constrainedStart < updatedAnnotations[annotationIndex - 1].end) {
          updatedAnnotations[annotationIndex - 1] = {
            ...updatedAnnotations[annotationIndex - 1],
            end: constrainedStart
          };
        }
      } else {
        const constrainedEnd = Math.max(annotation.start + 0.1, Math.min(newTime, duration));
        const delta = constrainedEnd - annotation.end;
        updatedAnnotations[annotationIndex] = {
          ...annotation,
          end: constrainedEnd
        };
        if (shouldLinkEndpoints && annotationIndex < updatedAnnotations.length - 1) {
          const nextAnnotation = updatedAnnotations[annotationIndex + 1];
          if (Math.abs(nextAnnotation.start - annotation.end) < LINK_THRESHOLD) {
            const newStart = nextAnnotation.start + delta;
            updatedAnnotations[annotationIndex + 1] = {
              ...nextAnnotation,
              start: Math.min(nextAnnotation.end - 0.1, newStart)
            };
            let currentIndex = annotationIndex + 1;
            while (currentIndex < updatedAnnotations.length - 1) {
              const current = updatedAnnotations[currentIndex];
              const next = updatedAnnotations[currentIndex + 1];
              if (Math.abs(next.start - current.end) < LINK_THRESHOLD) {
                const nextDelta = current.end - annotations[currentIndex].end;
                updatedAnnotations[currentIndex + 1] = {
                  ...next,
                  start: Math.min(next.end - 0.1, next.start + nextDelta)
                };
                currentIndex++;
              } else {
                break;
              }
            }
          } else if (constrainedEnd >= nextAnnotation.start) {
            updatedAnnotations[annotationIndex] = {
              ...updatedAnnotations[annotationIndex],
              end: nextAnnotation.start
            };
          }
        } else if (!shouldLinkEndpoints && annotationIndex < updatedAnnotations.length - 1 && constrainedEnd > updatedAnnotations[annotationIndex + 1].start) {
          const nextAnnotation = updatedAnnotations[annotationIndex + 1];
          updatedAnnotations[annotationIndex + 1] = {
            ...nextAnnotation,
            start: constrainedEnd
          };
          let currentIndex = annotationIndex + 1;
          while (currentIndex < updatedAnnotations.length - 1) {
            const current = updatedAnnotations[currentIndex];
            const next = updatedAnnotations[currentIndex + 1];
            if (current.end > next.start) {
              updatedAnnotations[currentIndex + 1] = {
                ...next,
                start: current.end
              };
              currentIndex++;
            } else {
              break;
            }
          }
        }
      }
      return updatedAnnotations;
    },
    []
  );
  return {
    continuousPlay,
    linkEndpoints,
    setContinuousPlay,
    setLinkEndpoints,
    updateAnnotationBoundaries
  };
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Annotation,
  AnnotationBox,
  AnnotationBoxesWrapper,
  AnnotationText,
  AnnotationsTrack,
  ContinuousPlayCheckbox,
  DownloadAnnotationsButton,
  EditableCheckbox,
  LinkEndpointsCheckbox,
  parseAeneas,
  serializeAeneas,
  useAnnotationControls
});
//# sourceMappingURL=index.js.map