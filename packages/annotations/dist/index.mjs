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
import { useState } from "react";
import styled from "styled-components";
import { jsx, jsxs } from "react/jsx-runtime";
var AnnotationOverlay = styled.div.attrs((props) => ({
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
var AnnotationText = styled.div`
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
var EditableText = styled.textarea`
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
var ControlsBar = styled.div`
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
var ControlButton = styled.button`
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
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(annotation.lines.join("\n"));
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
  return /* @__PURE__ */ jsxs(
    AnnotationOverlay,
    {
      $left: startPosition,
      $width: width,
      $color: color,
      onClick: handleClick,
      onDoubleClick: handleDoubleClick,
      children: [
        controls.length > 0 && /* @__PURE__ */ jsx(ControlsBar, { children: controls.map((control, idx) => /* @__PURE__ */ jsx(
          ControlButton,
          {
            title: control.title,
            onClick: (e) => {
              e.stopPropagation();
              handleControlClick(control);
            },
            children: control.text ? control.text : /* @__PURE__ */ jsx("i", { className: getIconClass(control.class || "") })
          },
          idx
        )) }),
        isEditing ? /* @__PURE__ */ jsx(
          EditableText,
          {
            value: editedText,
            onChange: handleTextChange,
            onBlur: handleTextBlur,
            autoFocus: true,
            onClick: (e) => e.stopPropagation(),
            onDoubleClick: (e) => e.stopPropagation()
          }
        ) : /* @__PURE__ */ jsx(AnnotationText, { children: annotation.lines.join("\n") })
      ]
    }
  );
};

// src/components/AnnotationBox.tsx
import styled2 from "styled-components";
import { useDraggable } from "@dnd-kit/core";
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
var Wrapper = styled2.div.attrs((props) => ({
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
var Box = styled2.div`
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
var Label = styled2.span`
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
var ResizeHandle = styled2.div`
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
  } = useDraggable({
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
  } = useDraggable({
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
  return /* @__PURE__ */ jsxs2(Wrapper, { $left: startPosition, $width: width, children: [
    /* @__PURE__ */ jsx2(
      Box,
      {
        $color: color,
        $isActive: isActive,
        onClick,
        children: label && /* @__PURE__ */ jsx2(Label, { children: label })
      }
    ),
    editable && /* @__PURE__ */ jsx2(
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
    editable && /* @__PURE__ */ jsx2(
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
import styled3 from "styled-components";
import { usePlaylistInfo } from "@waveform-playlist/ui-components";
import { jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
var Container = styled3.div.attrs((props) => ({
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
var ControlsPlaceholder = styled3.div`
  position: sticky;
  z-index: 200;
  left: 0;
  height: 100%;
  width: ${(props) => props.$controlWidth}px;
  flex-shrink: 0;
  background: transparent;
`;
var BoxesContainer = styled3.div`
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
  } = usePlaylistInfo();
  return /* @__PURE__ */ jsxs3(
    Container,
    {
      className,
      $height: height,
      $controlWidth: show ? controlWidth : 0,
      $width: width,
      children: [
        /* @__PURE__ */ jsx3(ControlsPlaceholder, { $controlWidth: show ? controlWidth : 0 }),
        /* @__PURE__ */ jsx3(BoxesContainer, { $offset: offset, children })
      ]
    }
  );
};

// src/components/AnnotationsTrack.tsx
import styled4 from "styled-components";
import { usePlaylistInfo as usePlaylistInfo2 } from "@waveform-playlist/ui-components";
import { jsx as jsx4, jsxs as jsxs4 } from "react/jsx-runtime";
var Container2 = styled4.div.attrs((props) => ({
  style: {
    height: `${props.$height}px`
  }
}))`
  position: relative;
  display: flex;
  ${(props) => props.$width !== void 0 && `width: ${props.$width}px;`}
  background: transparent;
`;
var ControlsPlaceholder2 = styled4.div`
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
var AnnotationsContainer = styled4.div`
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
  } = usePlaylistInfo2();
  return /* @__PURE__ */ jsxs4(
    Container2,
    {
      className,
      $height: height,
      $controlWidth: show ? controlWidth : 0,
      $width: width,
      children: [
        /* @__PURE__ */ jsx4(ControlsPlaceholder2, { $controlWidth: show ? controlWidth : 0, children: "Annotations" }),
        /* @__PURE__ */ jsx4(AnnotationsContainer, { $offset: offset, children })
      ]
    }
  );
};

// src/components/AnnotationText.tsx
import React2, { useRef, useEffect } from "react";
import styled5 from "styled-components";
import { jsx as jsx5, jsxs as jsxs5 } from "react/jsx-runtime";
var Container3 = styled5.div`
  background: ${(props) => props.theme?.backgroundColor || "#fff"};
  ${(props) => props.$height ? `height: ${props.$height}px;` : "max-height: 200px;"}
  overflow-y: auto;
  padding: 8px;
`;
var AnnotationItem = styled5.div`
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
var AnnotationHeader = styled5.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
`;
var AnnotationInfo = styled5.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;
var AnnotationIdLabel = styled5.span`
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
var TimeRange = styled5.span`
  font-size: 12px;
  font-weight: 500;
  color: ${(props) => props.theme?.textColorMuted || "#555"};
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  letter-spacing: 0.5px;
`;
var AnnotationControls = styled5.div`
  display: flex;
  gap: 6px;
`;
var ControlButton2 = styled5.button`
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
var AnnotationTextContent = styled5.div`
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
  const activeAnnotationRef = useRef(null);
  const containerRef = useRef(null);
  const prevActiveIdRef = useRef(void 0);
  useEffect(() => {
  });
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleScroll = () => {
    };
    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);
  useEffect(() => {
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
  return /* @__PURE__ */ jsx5(Container3, { ref: containerRef, $height: height, children: annotations.map((annotation, index) => {
    const isActive = annotation.id === activeAnnotationId;
    return /* @__PURE__ */ jsxs5(
      AnnotationItem,
      {
        ref: isActive ? activeAnnotationRef : null,
        $isActive: isActive,
        children: [
          /* @__PURE__ */ jsxs5(AnnotationHeader, { children: [
            /* @__PURE__ */ jsxs5(AnnotationInfo, { children: [
              /* @__PURE__ */ jsx5(
                AnnotationIdLabel,
                {
                  $isEditable: editable,
                  contentEditable: editable,
                  suppressContentEditableWarning: true,
                  onBlur: (e) => handleIdEdit(index, e.currentTarget.textContent || ""),
                  children: annotation.id
                }
              ),
              /* @__PURE__ */ jsxs5(TimeRange, { children: [
                formatTime(annotation.start),
                " - ",
                formatTime(annotation.end)
              ] })
            ] }),
            controls.length > 0 && /* @__PURE__ */ jsx5(AnnotationControls, { onClick: (e) => e.stopPropagation(), children: controls.map((control, idx) => /* @__PURE__ */ jsx5(
              ControlButton2,
              {
                title: control.title,
                onClick: () => handleControlClick(control, annotation, index),
                children: control.text ? control.text : /* @__PURE__ */ jsx5("i", { className: getIconClass(control.class || "") })
              },
              idx
            )) })
          ] }),
          /* @__PURE__ */ jsx5(
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
var AnnotationText2 = React2.memo(AnnotationTextComponent);

// src/components/ContinuousPlayCheckbox.tsx
import { BaseCheckboxWrapper, BaseCheckbox, BaseCheckboxLabel } from "@waveform-playlist/ui-components";
import { jsx as jsx6, jsxs as jsxs6 } from "react/jsx-runtime";
var ContinuousPlayCheckbox = ({
  checked,
  onChange,
  disabled = false,
  className
}) => {
  const handleChange = (e) => {
    onChange(e.target.checked);
  };
  return /* @__PURE__ */ jsxs6(BaseCheckboxWrapper, { className, children: [
    /* @__PURE__ */ jsx6(
      BaseCheckbox,
      {
        type: "checkbox",
        id: "continuous-play",
        className: "continuous-play",
        checked,
        onChange: handleChange,
        disabled
      }
    ),
    /* @__PURE__ */ jsx6(BaseCheckboxLabel, { htmlFor: "continuous-play", children: "Continuous Play" })
  ] });
};

// src/components/LinkEndpointsCheckbox.tsx
import { BaseCheckboxWrapper as BaseCheckboxWrapper2, BaseCheckbox as BaseCheckbox2, BaseCheckboxLabel as BaseCheckboxLabel2 } from "@waveform-playlist/ui-components";
import { jsx as jsx7, jsxs as jsxs7 } from "react/jsx-runtime";
var LinkEndpointsCheckbox = ({
  checked,
  onChange,
  disabled = false,
  className
}) => {
  const handleChange = (e) => {
    onChange(e.target.checked);
  };
  return /* @__PURE__ */ jsxs7(BaseCheckboxWrapper2, { className, children: [
    /* @__PURE__ */ jsx7(
      BaseCheckbox2,
      {
        type: "checkbox",
        id: "link-endpoints",
        className: "link-endpoints",
        checked,
        onChange: handleChange,
        disabled
      }
    ),
    /* @__PURE__ */ jsx7(BaseCheckboxLabel2, { htmlFor: "link-endpoints", children: "Link Endpoints" })
  ] });
};

// src/components/EditableCheckbox.tsx
import { BaseCheckboxWrapper as BaseCheckboxWrapper3, BaseCheckbox as BaseCheckbox3, BaseCheckboxLabel as BaseCheckboxLabel3 } from "@waveform-playlist/ui-components";
import { jsx as jsx8, jsxs as jsxs8 } from "react/jsx-runtime";
var EditableCheckbox = ({
  checked,
  onChange,
  className
}) => {
  return /* @__PURE__ */ jsxs8(BaseCheckboxWrapper3, { className, children: [
    /* @__PURE__ */ jsx8(
      BaseCheckbox3,
      {
        type: "checkbox",
        id: "editable-annotations",
        checked,
        onChange: (e) => onChange(e.target.checked)
      }
    ),
    /* @__PURE__ */ jsx8(BaseCheckboxLabel3, { htmlFor: "editable-annotations", children: "Editable Annotations" })
  ] });
};

// src/components/DownloadAnnotationsButton.tsx
import { BaseControlButton } from "@waveform-playlist/ui-components";
import { jsx as jsx9 } from "react/jsx-runtime";
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
  return /* @__PURE__ */ jsx9(
    BaseControlButton,
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
import { useState as useState2, useCallback } from "react";
var LINK_THRESHOLD = 0.01;
var useAnnotationControls = (options = {}) => {
  const {
    initialContinuousPlay = false,
    initialLinkEndpoints = true
  } = options;
  const [continuousPlay, setContinuousPlay] = useState2(initialContinuousPlay);
  const [linkEndpoints, setLinkEndpoints] = useState2(initialLinkEndpoints);
  const updateAnnotationBoundaries = useCallback(
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
export {
  Annotation,
  AnnotationBox,
  AnnotationBoxesWrapper,
  AnnotationText2 as AnnotationText,
  AnnotationsTrack,
  ContinuousPlayCheckbox,
  DownloadAnnotationsButton,
  EditableCheckbox,
  LinkEndpointsCheckbox,
  parseAeneas,
  serializeAeneas,
  useAnnotationControls
};
//# sourceMappingURL=index.mjs.map