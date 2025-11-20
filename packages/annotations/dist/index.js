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
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { className: getIconClass(control.class) })
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
var import_jsx_runtime2 = require("react/jsx-runtime");
var Box = import_styled_components2.default.div.attrs((props) => ({
  style: {
    left: `${props.$left}px`,
    width: `${props.$width}px`
  }
}))`
  position: absolute;
  top: 0;
  height: 100%;
  background: ${(props) => props.$isActive ? "rgba(255, 255, 255, 0.95)" : "rgba(255, 255, 255, 0.85)"};
  border: 2px solid ${(props) => props.$isActive ? "#d67600" : props.$color};
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
    background: rgba(255, 255, 255, 0.98);
    border-color: #d67600;
    border-width: 3px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  }
`;
var Label = import_styled_components2.default.span`
  font-size: 12px;
  font-weight: 600;
  color: #2a2a2a;
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
  ${(props) => props.$position}: -15px;
  width: 30px;
  height: 100%;
  cursor: ew-resize;
  z-index: 2;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 4px;

  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 6px;
    height: 70%;
    background: rgba(0, 0, 0, 0.5);
    border-radius: 3px;
    opacity: 0.7;
    transition: opacity 0.2s, background 0.2s;
  }

  &:hover {
    background: rgba(0, 0, 0, 0.15);
  }

  &:hover::before {
    opacity: 1;
    background: rgba(0, 0, 0, 0.8);
  }
`;
var AnnotationBox = ({
  startPosition,
  endPosition,
  label,
  color = "#ff9800",
  isActive = false,
  onClick,
  onDragStart,
  onDrag,
  onDragEnd
}) => {
  const width = Math.max(0, endPosition - startPosition);
  if (width <= 0) {
    return null;
  }
  const handleDragStart = (edge) => (e) => {
    const dragImage = document.createElement("div");
    dragImage.style.position = "absolute";
    dragImage.style.top = "-9999px";
    dragImage.style.width = "1px";
    dragImage.style.height = "1px";
    dragImage.style.opacity = "0";
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    e.dataTransfer.effectAllowed = "move";
    setTimeout(() => {
      document.body.removeChild(dragImage);
    }, 0);
    if (onDragStart) {
      onDragStart(edge, e);
    }
  };
  const handleHandleClick = (e) => {
    e.stopPropagation();
  };
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
    Box,
    {
      $left: startPosition,
      $width: width,
      $color: color,
      $isActive: isActive,
      onClick,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          ResizeHandle,
          {
            $position: "left",
            draggable: "true",
            onDragStart: handleDragStart("start"),
            onDrag,
            onDragEnd,
            onClick: handleHandleClick
          }
        ),
        label && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Label, { children: label }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          ResizeHandle,
          {
            $position: "right",
            draggable: "true",
            onDragStart: handleDragStart("end"),
            onDrag,
            onDragEnd,
            onClick: handleHandleClick
          }
        )
      ]
    }
  );
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
  background: #f5f5f5;
  border-top: 2px solid #ddd;
  border-bottom: 1px solid #ddd;
  z-index: 110;
`;
var ControlsPlaceholder = import_styled_components3.default.div`
  position: sticky;
  z-index: 200;
  left: 0;
  height: 100%;
  width: ${(props) => props.$controlWidth}px;
  flex-shrink: 0;
  background: #fff;
  border-right: 1px solid #ddd;
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
  background: #f5f5f5;
  border-top: 2px solid #ddd;
`;
var ControlsPlaceholder2 = import_styled_components4.default.div`
  position: sticky;
  z-index: 200;
  left: 0;
  height: 100%;
  width: ${(props) => props.$controlWidth}px;
  flex-shrink: 0;
  background: #fff;
  border-right: 1px solid #ddd;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #666;
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
  background: #fff;
  border-top: 2px solid #ddd;
  max-height: 200px;
  overflow-y: auto;
  padding: 8px;
`;
var AnnotationItem = import_styled_components5.default.div`
  padding: 12px;
  margin-bottom: 6px;
  border-left: 4px solid ${(props) => props.$isActive ? "#ff9800" : "#ccc"};
  background: ${(props) => props.$isActive ? "#fff3e0" : "#f9f9f9"};
  border-radius: 4px;
  transition: all 0.2s;
  cursor: pointer;
  box-shadow: ${(props) => props.$isActive ? "0 2px 4px rgba(255, 152, 0, 0.2)" : "none"};

  &:hover {
    background: ${(props) => props.$isActive ? "#ffe9cc" : "#f0f0f0"};
    border-left-color: #ff9800;
  }
`;
var AnnotationHeader = import_styled_components5.default.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
`;
var TimeRange = import_styled_components5.default.span`
  font-size: 12px;
  font-weight: 500;
  color: #555;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  letter-spacing: 0.5px;
`;
var AnnotationControls = import_styled_components5.default.div`
  display: flex;
  gap: 6px;
`;
var ControlButton2 = import_styled_components5.default.button`
  background: transparent;
  border: 1px solid #ccc;
  padding: 4px 8px;
  font-size: 14px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s ease;

  &:hover {
    background: #e8e8e8;
    border-color: #999;
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.95);
  }
`;
var AnnotationTextContent = import_styled_components5.default.div`
  font-size: 14px;
  line-height: 1.6;
  color: #2a2a2a;
  white-space: pre-wrap;
  word-break: break-word;
  outline: ${(props) => props.$isEditable ? "1px dashed #ddd" : "none"};
  padding: ${(props) => props.$isEditable ? "6px" : "0"};
  border-radius: 3px;
  min-height: 20px;

  &[contenteditable='true']:focus {
    outline: 2px solid #ff9800;
    background: #fffef7;
  }
`;
var AnnotationTextComponent = ({
  annotations,
  activeAnnotationId,
  shouldScrollToActive = false,
  editable = false,
  controls = [],
  annotationListConfig,
  onAnnotationClick,
  onAnnotationUpdate
}) => {
  const activeAnnotationRef = (0, import_react2.useRef)(null);
  const containerRef = (0, import_react2.useRef)(null);
  const prevActiveIdRef = (0, import_react2.useRef)(void 0);
  (0, import_react2.useEffect)(() => {
    console.log("[AnnotationText] Render - activeAnnotationId:", activeAnnotationId, "prev:", prevActiveIdRef.current, "scrollTop:", containerRef.current?.scrollTop);
  });
  (0, import_react2.useEffect)(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleScroll = () => {
      console.log("[AnnotationText] Scroll event - scrollTop:", container.scrollTop);
    };
    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);
  (0, import_react2.useEffect)(() => {
    console.log("[AnnotationText] useEffect triggered - activeAnnotationId:", activeAnnotationId, "shouldScrollToActive:", shouldScrollToActive, "will scroll:", !!(activeAnnotationId && activeAnnotationRef.current && shouldScrollToActive));
    if (activeAnnotationId && activeAnnotationRef.current && shouldScrollToActive) {
      console.log("[AnnotationText] Calling scrollIntoView for:", activeAnnotationId);
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
  const handleControlClick = (control, annotation, index) => {
    if (!onAnnotationUpdate) return;
    const annotationsCopy = [...annotations];
    control.action(annotationsCopy[index], index, annotationsCopy, annotationListConfig || {});
    onAnnotationUpdate(annotationsCopy);
  };
  const getIconClass = (classString) => {
    return classString.replace(/\./g, " ");
  };
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Container3, { ref: containerRef, children: annotations.map((annotation, index) => {
    const isActive = annotation.id === activeAnnotationId;
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
      AnnotationItem,
      {
        ref: isActive ? activeAnnotationRef : null,
        $isActive: isActive,
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(AnnotationHeader, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(TimeRange, { children: [
              formatTime(annotation.start),
              " - ",
              formatTime(annotation.end)
            ] }),
            controls.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(AnnotationControls, { onClick: (e) => e.stopPropagation(), children: controls.map((control, idx) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
              ControlButton2,
              {
                title: control.title,
                onClick: () => handleControlClick(control, annotation, index),
                children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("i", { className: getIconClass(control.class) })
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
var import_styled_components6 = __toESM(require("styled-components"));
var import_jsx_runtime6 = require("react/jsx-runtime");
var CheckboxWrapper = import_styled_components6.default.div`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
`;
var Checkbox = import_styled_components6.default.input`
  cursor: pointer;
`;
var Label2 = import_styled_components6.default.label`
  margin: 0;
  cursor: pointer;
  user-select: none;
`;
var ContinuousPlayCheckbox = ({
  checked,
  onChange,
  disabled = false,
  className
}) => {
  const handleChange = (e) => {
    onChange(e.target.checked);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(CheckboxWrapper, { className, children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      Checkbox,
      {
        type: "checkbox",
        id: "continuous-play",
        className: "continuous-play",
        checked,
        onChange: handleChange,
        disabled
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Label2, { htmlFor: "continuous-play", children: "Continuous Play" })
  ] });
};

// src/components/LinkEndpointsCheckbox.tsx
var import_styled_components7 = __toESM(require("styled-components"));
var import_jsx_runtime7 = require("react/jsx-runtime");
var CheckboxWrapper2 = import_styled_components7.default.div`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
`;
var Checkbox2 = import_styled_components7.default.input`
  cursor: pointer;
`;
var Label3 = import_styled_components7.default.label`
  margin: 0;
  cursor: pointer;
  user-select: none;
`;
var LinkEndpointsCheckbox = ({
  checked,
  onChange,
  disabled = false,
  className
}) => {
  const handleChange = (e) => {
    onChange(e.target.checked);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(CheckboxWrapper2, { className, children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      Checkbox2,
      {
        type: "checkbox",
        id: "link-endpoints",
        className: "link-endpoints",
        checked,
        onChange: handleChange,
        disabled
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Label3, { htmlFor: "link-endpoints", children: "Link Endpoints" })
  ] });
};

// src/components/EditableCheckbox.tsx
var import_styled_components8 = __toESM(require("styled-components"));
var import_jsx_runtime8 = require("react/jsx-runtime");
var Label4 = import_styled_components8.default.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.9rem;
  user-select: none;
`;
var Checkbox3 = import_styled_components8.default.input.attrs({ type: "checkbox" })`
  cursor: pointer;
`;
var EditableCheckbox = ({
  checked,
  onChange,
  className
}) => {
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(Label4, { className, children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      Checkbox3,
      {
        checked,
        onChange: (e) => onChange(e.target.checked)
      }
    ),
    "Editable Annotations"
  ] });
};

// src/components/DownloadAnnotationsButton.tsx
var import_styled_components9 = __toESM(require("styled-components"));
var import_jsx_runtime9 = require("react/jsx-runtime");
var Button = import_styled_components9.default.button`
  padding: 0.5rem 1rem;
  background: #17a2b8;
  color: white;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;

  &:hover:not(:disabled) {
    background: #138496;
  }

  &:disabled {
    background: #6c757d;
    cursor: not-allowed;
    opacity: 0.6;
  }
`;
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
    Button,
    {
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
      duration
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
        if (linkEndpoints && annotationIndex > 0) {
          const prevAnnotation = updatedAnnotations[annotationIndex - 1];
          if (Math.abs(prevAnnotation.end - annotation.start) < LINK_THRESHOLD) {
            updatedAnnotations[annotationIndex - 1] = {
              ...prevAnnotation,
              end: Math.max(prevAnnotation.start + 0.1, prevAnnotation.end + delta)
            };
          }
        } else if (!linkEndpoints && annotationIndex > 0 && constrainedStart < updatedAnnotations[annotationIndex - 1].end) {
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
        if (linkEndpoints && annotationIndex < updatedAnnotations.length - 1) {
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
          }
        } else if (!linkEndpoints && annotationIndex < updatedAnnotations.length - 1 && constrainedEnd > updatedAnnotations[annotationIndex + 1].start) {
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
    [linkEndpoints]
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