n<template>
  <div class="app-container">
    <!-- 头部 -->
    <header class="header">
      <h1>图像编辑器</h1>
      <button 
        v-if="imageLoaded" 
        @click="exportImage" 
        class="export-btn"
      >
        导出图片
      </button>
    </header>

    <!-- 主内容区 -->
    <main class="main-content">
      <!-- 上传区域 -->
      <div v-if="!imageLoaded" class="upload-area" @click="triggerFileInput">
        <input 
          ref="fileInput" 
          type="file" 
          accept="image/*" 
          @change="handleFileUpload"
          style="display: none"
        >
        <div class="upload-icon">📷</div>
        <p class="upload-text">点击上传图片</p>
        <p class="upload-hint">支持 JPG、PNG、WebP 等格式</p>
      </div>

      <!-- 编辑区域 -->
      <div v-else class="editor-container">
        <!-- 左侧：图片预览 -->
        <div class="preview-section">
          <div class="image-wrapper">
            <div class="canvas-container">
              <canvas ref="canvas" class="preview-canvas"></canvas>
              <div 
                v-if="showCropBox"
                class="crop-box"
                :style="cropBoxStyle"
                @mousedown="startDrag"
                @touchstart="startDrag"
              >
                <div class="crop-handle tl" @mousedown.stop="startResize('tl')" @touchstart.stop="startResize('tl')"></div>
                <div class="crop-handle tr" @mousedown.stop="startResize('tr')" @touchstart.stop="startResize('tr')"></div>
                <div class="crop-handle bl" @mousedown.stop="startResize('bl')" @touchstart.stop="startResize('bl')"></div>
                <div class="crop-handle br" @mousedown.stop="startResize('br')" @touchstart.stop="startResize('br')"></div>
              </div>
            </div>
          </div>
          <button @click="resetImage" class="reset-btn">重新上传</button>
        </div>

        <!-- 右侧：控制面板 -->
        <div class="control-panel">
          <div class="control-section">
            <h3>裁剪尺寸</h3>
            <div class="unit-toggle">
              <button 
                :class="{ active: unit === 'mm' }" 
                @click="unit = 'mm'"
              >
                毫米 (mm)
              </button>
              <button 
                :class="{ active: unit === 'cm' }" 
                @click="unit = 'cm'"
              >
                厘米 (cm)
              </button>
            </div>
            <div class="input-group">
              <label>宽度</label>
              <input 
                type="number" 
                v-model.number="cropWidth" 
                @input="updateCropBox"
                :step="unit === 'mm' ? 1 : 0.1"
                min="0"
              >
              <span>{{ unit }}</span>
            </div>
            <div class="input-group">
              <label>高度</label>
              <input 
                type="number" 
                v-model.number="cropHeight" 
                @input="updateCropBox"
                :step="unit === 'mm' ? 1 : 0.1"
                min="0"
              >
              <span>{{ unit }}</span>
            </div>
            <button @click="applyCrop" class="apply-btn">应用裁剪</button>
            <div class="history-controls">
              <button @click="undo" :disabled="!canUndo" title="撤回 (Ctrl+Z)">↶ 撤回</button>
              <button @click="redo" :disabled="!canRedo" title="前进 (Ctrl+Y)">↷ 前进</button>
            </div>
          </div>

          <div class="control-section">
            <h3>图片控制</h3>
            <div class="zoom-section">
              <div class="zoom-controls">
                <label>缩放</label>
                <button @click="adjustZoom(-1)" class="zoom-btn">-</button>
                <input 
                  type="number" 
                  v-model="zoomPercent" 
                  @change="updateZoomFromInput"
                  @blur="updateZoomFromInput"
                  min="10"
                  max="500"
                  step="1"
                  class="zoom-input"
                >
                <span class="zoom-unit">%</span>
                <button @click="adjustZoom(1)" class="zoom-btn">+</button>
                <button @click="resetZoom" class="reset-zoom-btn">重置</button>
              </div>
              <input 
                type="range" 
                v-model.number="zoomPercent" 
                @input="updateZoomFromInput"
                min="10"
                max="500"
                step="1"
                class="zoom-slider"
              >
            </div>
            <p class="hint">滚轮缩放 / 拖动画布移动图片</p>
          </div>

          <div class="control-section">
            <h3>DPI 设置</h3>
            <div class="input-group">
              <label>目标 DPI</label>
              <input 
                type="number" 
                v-model.number="targetDPI" 
                min="72"
                max="600"
                step="1"
              >
            </div>
          </div>

          <div class="control-section">
            <h3>输出设置</h3>
            <div class="format-options">
              <label v-for="format in formats" :key="format.value">
                <input 
                  type="radio" 
                  :value="format.value" 
                  v-model="outputFormat"
                >
                <span>{{ format.label }}</span>
              </label>
            </div>
            <div class="input-group" style="margin-top: 1rem;">
              <label>倍数</label>
              <input 
                type="number" 
                v-model.number="exportScale" 
                min="1"
                max="5"
                step="1"
              >
              <span>x</span>
            </div>
            <p class="hint">导出图片将按设置倍数放大</p>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'

const fileInput = ref(null)
const canvas = ref(null)
const imageLoaded = ref(false)
const originalImage = ref(null)
const croppedImage = ref(null)

// 裁剪相关
const unit = ref('mm')
const cropWidth = ref(100)
const cropHeight = ref(100)
const showCropBox = ref(true)

// 裁剪框位置和尺寸（像素）
const cropBox = ref({
  x: 0,
  y: 0,
  width: 200,
  height: 200
})

// DPI 和格式
const targetDPI = ref(300)
const outputFormat = ref('image/png')
const exportScale = ref(3)
const formats = [
  { label: 'PNG', value: 'image/png' },
  { label: 'JPEG', value: 'image/jpeg' },
  { label: 'WebP', value: 'image/webp' }
]

// 拖拽相关
const isDragging = ref(false)
const isResizing = ref(false)
const resizeHandle = ref('')
const dragStart = ref({ x: 0, y: 0 })
const canvasRect = ref(null)

// 图片缩放和移动
const imageScale = ref(1)
const imageOffset = ref({ x: 0, y: 0 })
const isDraggingImage = ref(false)
const imageDragStart = ref({ x: 0, y: 0 })
const zoomPercent = ref(100)

// 历史记录（撤回/前进）
const history = ref([])
const historyIndex = ref(-1)
const canUndo = computed(() => historyIndex.value > 0)
const canRedo = computed(() => historyIndex.value < history.value.length - 1)

const triggerFileInput = () => {
  fileInput.value?.click()
}

const handleFileUpload = (event) => {
  const file = event.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    const img = new Image()
    img.onload = () => {
      originalImage.value = img
      imageLoaded.value = true
      
      // 初始化历史记录
      history.value = [{
        image: img.src,
        isCropped: false,
        showCropBox: true,
        imageScale: 1,
        imageOffset: { x: 0, y: 0 }
      }]
      historyIndex.value = 0
      
      nextTick(() => {
        drawImage()
        initCropBox()
      })
    }
    img.src = e.target.result
  }
  reader.readAsDataURL(file)
}

const drawImage = () => {
  if (!canvas.value || !originalImage.value) return

  const ctx = canvas.value.getContext('2d')
  const img = croppedImage.value || originalImage.value
  
  // 设置画布尺寸
  const maxWidth = window.innerWidth > 768 ? 800 : window.innerWidth - 40
  const maxHeight = window.innerHeight - 300
  
  let width = img.width
  let height = img.height
  
  if (width > maxWidth) {
    height = (maxWidth / width) * height
    width = maxWidth
  }
  
  if (height > maxHeight) {
    width = (maxHeight / height) * width
    height = maxHeight
  }
  
  canvas.value.width = width
  canvas.value.height = height
  
  ctx.clearRect(0, 0, width, height)
  
  // 应用缩放和偏移
  ctx.save()
  ctx.translate(width / 2 + imageOffset.value.x, height / 2 + imageOffset.value.y)
  ctx.scale(imageScale.value, imageScale.value)
  ctx.drawImage(img, -width / 2, -height / 2, width, height)
  ctx.restore()
}

const initCropBox = () => {
  if (!canvas.value) return
  
  const width = Math.min(200, canvas.value.width * 0.6)
  const height = Math.min(200, canvas.value.height * 0.6)
  
  cropBox.value = {
    x: (canvas.value.width - width) / 2,
    y: (canvas.value.height - height) / 2,
    width,
    height
  }
  
  updateCropDimensions()
}

const updateCropDimensions = () => {
  if (!canvas.value || !originalImage.value) return
  
  const scale = originalImage.value.width / canvas.value.width
  const dpi = 25.4 // 1 inch = 25.4mm
  const pixelsPerMM = targetDPI.value / dpi
  
  const widthMM = (cropBox.value.width * scale) / pixelsPerMM
  const heightMM = (cropBox.value.height * scale) / pixelsPerMM
  
  if (unit.value === 'mm') {
    cropWidth.value = Math.round(widthMM * 10) / 10
    cropHeight.value = Math.round(heightMM * 10) / 10
  } else {
    cropWidth.value = Math.round(widthMM / 10 * 10) / 10
    cropHeight.value = Math.round(heightMM / 10 * 10) / 10
  }
}

const updateCropBox = () => {
  if (!canvas.value || !originalImage.value) return
  
  const scale = originalImage.value.width / canvas.value.width
  const dpi = 25.4
  const pixelsPerMM = targetDPI.value / dpi
  
  const widthMM = unit.value === 'mm' ? cropWidth.value : cropWidth.value * 10
  const heightMM = unit.value === 'mm' ? cropHeight.value : cropHeight.value * 10
  
  const widthPx = (widthMM * pixelsPerMM) / scale
  const heightPx = (heightMM * pixelsPerMM) / scale
  
  cropBox.value.width = Math.min(widthPx, canvas.value.width)
  cropBox.value.height = Math.min(heightPx, canvas.value.height)
  
  // 确保裁剪框不超出画布
  if (cropBox.value.x + cropBox.value.width > canvas.value.width) {
    cropBox.value.x = canvas.value.width - cropBox.value.width
  }
  if (cropBox.value.y + cropBox.value.height > canvas.value.height) {
    cropBox.value.y = canvas.value.height - cropBox.value.height
  }
}

const cropBoxStyle = computed(() => {
  return {
    left: `${cropBox.value.x}px`,
    top: `${cropBox.value.y}px`,
    width: `${cropBox.value.width}px`,
    height: `${cropBox.value.height}px`
  }
})

const startDrag = (e) => {
  if (isResizing.value) return
  
  isDragging.value = true
  const clientX = e.touches ? e.touches[0].clientX : e.clientX
  const clientY = e.touches ? e.touches[0].clientY : e.clientY
  
  canvasRect.value = canvas.value.getBoundingClientRect()
  dragStart.value = {
    x: clientX - cropBox.value.x - canvasRect.value.left,
    y: clientY - cropBox.value.y - canvasRect.value.top
  }
  
  e.preventDefault()
}

const startImageDrag = (e) => {
  if (!showCropBox.value) return
  
  isDraggingImage.value = true
  const clientX = e.touches ? e.touches[0].clientX : e.clientX
  const clientY = e.touches ? e.touches[0].clientY : e.clientY
  
  imageDragStart.value = {
    x: clientX - imageOffset.value.x,
    y: clientY - imageOffset.value.y
  }
  
  e.preventDefault()
}

const startResize = (handle) => {
  isResizing.value = true
  resizeHandle.value = handle
  canvasRect.value = canvas.value.getBoundingClientRect()
}

const handleMouseMove = (e) => {
  const clientX = e.touches ? e.touches[0].clientX : e.clientX
  const clientY = e.touches ? e.touches[0].clientY : e.clientY
  
  if (isDraggingImage.value) {
    imageOffset.value = {
      x: clientX - imageDragStart.value.x,
      y: clientY - imageDragStart.value.y
    }
    drawImage()
  } else if (isDragging.value && !isResizing.value) {
    const newX = clientX - canvasRect.value.left - dragStart.value.x
    const newY = clientY - canvasRect.value.top - dragStart.value.y
    
    cropBox.value.x = Math.max(0, Math.min(newX, canvas.value.width - cropBox.value.width))
    cropBox.value.y = Math.max(0, Math.min(newY, canvas.value.height - cropBox.value.height))
  } else if (isResizing.value) {
    const mouseX = clientX - canvasRect.value.left
    const mouseY = clientY - canvasRect.value.top
    
    const handle = resizeHandle.value
    const box = { ...cropBox.value }
    
    if (handle.includes('t')) {
      const newY = Math.max(0, Math.min(mouseY, box.y + box.height - 20))
      box.height = box.height + (box.y - newY)
      box.y = newY
    }
    if (handle.includes('b')) {
      box.height = Math.max(20, Math.min(mouseY - box.y, canvas.value.height - box.y))
    }
    if (handle.includes('l')) {
      const newX = Math.max(0, Math.min(mouseX, box.x + box.width - 20))
      box.width = box.width + (box.x - newX)
      box.x = newX
    }
    if (handle.includes('r')) {
      box.width = Math.max(20, Math.min(mouseX - box.x, canvas.value.width - box.x))
    }
    
    cropBox.value = box
    updateCropDimensions()
  }
}

const handleMouseUp = () => {
  isDragging.value = false
  isResizing.value = false
  isDraggingImage.value = false
  resizeHandle.value = ''
}

const adjustZoom = (delta) => {
  zoomPercent.value = Math.max(10, Math.min(500, zoomPercent.value + delta))
  imageScale.value = zoomPercent.value / 100
  drawImage()
}

const updateZoomFromInput = () => {
  zoomPercent.value = Math.max(10, Math.min(500, zoomPercent.value))
  imageScale.value = zoomPercent.value / 100
  drawImage()
}

const resetZoom = () => {
  imageScale.value = 1
  zoomPercent.value = 100
  imageOffset.value = { x: 0, y: 0 }
  drawImage()
}

const handleWheel = (e) => {
  if (!showCropBox.value) return
  
  e.preventDefault()
  
  // 滚轮缩放改为5%步进
  const delta = e.deltaY > 0 ? -5 : 5
  adjustZoom(delta)
}

const saveToHistory = () => {
  // 保存当前状态到历史记录
  const state = {
    image: croppedImage.value ? croppedImage.value.src : originalImage.value.src,
    isCropped: !!croppedImage.value,
    showCropBox: showCropBox.value,
    imageScale: imageScale.value,
    imageOffset: { ...imageOffset.value }
  }
  
  // 删除当前位置之后的历史记录
  history.value = history.value.slice(0, historyIndex.value + 1)
  
  // 添加新状态
  history.value.push(state)
  historyIndex.value = history.value.length - 1
  
  // 限制历史记录数量（最多20条）
  if (history.value.length > 20) {
    history.value.shift()
    historyIndex.value--
  }
}

const undo = () => {
  if (!canUndo.value) return
  
  historyIndex.value--
  restoreFromHistory()
}

const redo = () => {
  if (!canRedo.value) return
  
  historyIndex.value++
  restoreFromHistory()
}

const restoreFromHistory = () => {
  const state = history.value[historyIndex.value]
  if (!state) return
  
  const img = new Image()
  img.onload = () => {
    if (state.isCropped) {
      croppedImage.value = img
    } else {
      originalImage.value = img
      croppedImage.value = null
    }
    
    showCropBox.value = state.showCropBox
    imageScale.value = state.imageScale
    zoomPercent.value = Math.round(state.imageScale * 100)
    imageOffset.value = { ...state.imageOffset }
    
    nextTick(() => {
      drawImage()
      if (showCropBox.value) {
        initCropBox()
      }
    })
  }
  img.src = state.image
}

const applyCrop = () => {
  if (!canvas.value || !originalImage.value) return
  
  // 创建临时画布来渲染缩放和偏移后的图片
  const tempCanvas = document.createElement('canvas')
  const baseWidth = canvas.value.width
  const baseHeight = canvas.value.height
  
  tempCanvas.width = baseWidth
  tempCanvas.height = baseHeight
  const tempCtx = tempCanvas.getContext('2d')
  
  // 绘制缩放和偏移后的图片
  tempCtx.save()
  tempCtx.translate(baseWidth / 2 + imageOffset.value.x, baseHeight / 2 + imageOffset.value.y)
  tempCtx.scale(imageScale.value, imageScale.value)
  tempCtx.drawImage(originalImage.value, -baseWidth / 2, -baseHeight / 2, baseWidth, baseHeight)
  tempCtx.restore()
  
  // 裁剪指定区域
  const cropData = {
    x: cropBox.value.x,
    y: cropBox.value.y,
    width: cropBox.value.width,
    height: cropBox.value.height
  }
  
  const cropCanvas = document.createElement('canvas')
  cropCanvas.width = cropData.width
  cropCanvas.height = cropData.height
  const cropCtx = cropCanvas.getContext('2d')
  
  cropCtx.drawImage(
    tempCanvas,
    cropData.x, cropData.y, cropData.width, cropData.height,
    0, 0, cropData.width, cropData.height
  )
  
  const croppedImg = new Image()
  croppedImg.onload = () => {
    croppedImage.value = croppedImg
    showCropBox.value = false
    imageScale.value = 1
    imageOffset.value = { x: 0, y: 0 }
    drawImage()
    
    // 保存到历史记录
    saveToHistory()
  }
  croppedImg.src = cropCanvas.toDataURL()
}

const exportImage = () => {
  if (!canvas.value) return
  
  const img = croppedImage.value || originalImage.value
  const exportCanvas = document.createElement('canvas')
  
  // 计算目标尺寸
  const dpi = 25.4
  const pixelsPerMM = targetDPI.value / dpi
  
  let widthMM, heightMM
  if (showCropBox.value) {
    widthMM = cropBox.value.width / pixelsPerMM
    heightMM = cropBox.value.height / pixelsPerMM
  } else {
    widthMM = img.width / pixelsPerMM
    heightMM = img.height / pixelsPerMM
  }
  
  // 应用导出倍数
  exportCanvas.width = Math.round(widthMM * pixelsPerMM * exportScale.value)
  exportCanvas.height = Math.round(heightMM * pixelsPerMM * exportScale.value)
  
  const ctx = exportCanvas.getContext('2d')
  
  // 启用图像平滑以获得更好的缩放质量
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  
  if (showCropBox.value) {
    // 创建临时画布来渲染缩放和偏移后的图片
    const tempCanvas = document.createElement('canvas')
    const baseWidth = canvas.value.width
    const baseHeight = canvas.value.height
    
    tempCanvas.width = baseWidth
    tempCanvas.height = baseHeight
    const tempCtx = tempCanvas.getContext('2d')
    
    tempCtx.save()
    tempCtx.translate(baseWidth / 2 + imageOffset.value.x, baseHeight / 2 + imageOffset.value.y)
    tempCtx.scale(imageScale.value, imageScale.value)
    tempCtx.drawImage(originalImage.value, -baseWidth / 2, -baseHeight / 2, baseWidth, baseHeight)
    tempCtx.restore()
    
    ctx.drawImage(
      tempCanvas,
      cropBox.value.x,
      cropBox.value.y,
      cropBox.value.width,
      cropBox.value.height,
      0, 0,
      exportCanvas.width,
      exportCanvas.height
    )
  } else {
    ctx.drawImage(img, 0, 0, exportCanvas.width, exportCanvas.height)
  }
  
  // 导出
  exportCanvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const ext = outputFormat.value.split('/')[1]
    const scaleSuffix = exportScale.value > 1 ? `@${exportScale.value}x` : ''
    a.download = `edited-image${scaleSuffix}-${Date.now()}.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }, outputFormat.value, 0.95)
}

const resetImage = () => {
  imageLoaded.value = false
  originalImage.value = null
  croppedImage.value = null
  showCropBox.value = true
  imageScale.value = 1
  zoomPercent.value = 100
  imageOffset.value = { x: 0, y: 0 }
  history.value = []
  historyIndex.value = -1
  fileInput.value.value = ''
}

const handleKeyDown = (e) => {
  // Ctrl+Z 撤回
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault()
    undo()
  }
  // Ctrl+Y 或 Ctrl+Shift+Z 前进
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
    e.preventDefault()
    redo()
  }
}

onMounted(() => {
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseup', handleMouseUp)
  window.addEventListener('touchmove', handleMouseMove, { passive: false })
  window.addEventListener('touchend', handleMouseUp)
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('resize', () => {
    if (imageLoaded.value) {
      drawImage()
    }
  })
  
  if (canvas.value) {
    canvas.value.addEventListener('wheel', handleWheel, { passive: false })
    canvas.value.addEventListener('mousedown', startImageDrag)
    canvas.value.addEventListener('touchstart', startImageDrag, { passive: false })
  }
})

onUnmounted(() => {
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('mouseup', handleMouseUp)
  window.removeEventListener('touchmove', handleMouseMove)
  window.removeEventListener('touchend', handleMouseUp)
  window.removeEventListener('keydown', handleKeyDown)
  
  if (canvas.value) {
    canvas.value.removeEventListener('wheel', handleWheel)
    canvas.value.removeEventListener('mousedown', startImageDrag)
    canvas.value.removeEventListener('touchstart', startImageDrag)
  }
})
</script>

<style scoped>
.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  position: relative;
}

.app-container::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: 
    radial-gradient(circle at 20% 50%, rgba(120, 119, 198, 0.3), transparent 50%),
    radial-gradient(circle at 80% 80%, rgba(138, 43, 226, 0.2), transparent 50%);
  pointer-events: none;
}

.header {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  padding: 1.25rem 2.5rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: sticky;
  top: 0;
  z-index: 100;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.header h1 {
  font-size: 1.75rem;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: -0.5px;
}

.export-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 0.875rem 2rem;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
  position: relative;
  overflow: hidden;
}

.export-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  transition: left 0.5s;
}

.export-btn:hover::before {
  left: 100%;
}

.export-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 25px rgba(102, 126, 234, 0.5);
}

.export-btn:active {
  transform: translateY(0);
}

.main-content {
  flex: 1;
  padding: 2.5rem;
  position: relative;
  z-index: 1;
}

.upload-area {
  max-width: 550px;
  margin: 4rem auto;
  padding: 5rem 3rem;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border: 3px dashed rgba(102, 126, 234, 0.3);
  border-radius: 24px;
  text-align: center;
  cursor: pointer;
  transition: all 0.4s ease;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
}

.upload-area:hover {
  border-color: #667eea;
  background: rgba(255, 255, 255, 1);
  transform: translateY(-5px);
  box-shadow: 0 15px 50px rgba(102, 126, 234, 0.3);
}

.upload-icon {
  font-size: 5rem;
  margin-bottom: 1.5rem;
  filter: drop-shadow(0 4px 8px rgba(102, 126, 234, 0.3));
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.upload-text {
  font-size: 1.5rem;
  font-weight: 600;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 0.75rem;
}

.upload-hint {
  color: #888;
  font-size: 1rem;
}

.editor-container {
  display: flex;
  gap: 2.5rem;
  max-width: 1500px;
  margin: 0 auto;
}

.preview-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.image-wrapper {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  padding: 1.5rem;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  position: relative;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.canvas-container {
  position: relative;
  background-image: 
    linear-gradient(45deg, #e8e8e8 25%, transparent 25%),
    linear-gradient(-45deg, #e8e8e8 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #e8e8e8 75%),
    linear-gradient(-45deg, transparent 75%, #e8e8e8 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
  background-color: #f8f8f8;
  display: inline-block;
  border-radius: 12px;
  overflow: hidden;
}

.preview-canvas {
  display: block;
  max-width: 100%;
  height: auto;
  position: relative;
  cursor: move;
  outline: 2px dashed rgba(102, 126, 234, 0.5);
  outline-offset: -2px;
  box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.5);
}

.crop-box {
  position: absolute;
  border: 3px solid #667eea;
  box-shadow: 
    0 0 0 9999px rgba(0, 0, 0, 0.6),
    0 0 20px rgba(102, 126, 234, 0.5),
    inset 0 0 0 1px rgba(255, 255, 255, 0.3);
  cursor: move;
  touch-action: none;
}

.crop-handle {
  position: absolute;
  width: 14px;
  height: 14px;
  background: white;
  border: 3px solid #667eea;
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
  transition: all 0.2s ease;
}

.crop-handle:hover {
  transform: scale(1.3);
  background: #667eea;
  border-color: white;
}

.crop-handle.tl { top: -7px; left: -7px; cursor: nwse-resize; }
.crop-handle.tr { top: -7px; right: -7px; cursor: nesw-resize; }
.crop-handle.bl { bottom: -7px; left: -7px; cursor: nesw-resize; }
.crop-handle.br { bottom: -7px; right: -7px; cursor: nwse-resize; }

.reset-btn {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
  border: none;
  padding: 0.875rem;
  border-radius: 12px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(245, 87, 108, 0.3);
}

.reset-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(245, 87, 108, 0.4);
}

.reset-btn:active {
  transform: translateY(0);
}

.control-panel {
  width: 320px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.control-section {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  padding: 1rem 1.25rem;
  border-radius: 14px;
  box-shadow: 0 6px 25px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  transition: all 0.3s ease;
}

.control-section:hover {
  box-shadow: 0 10px 35px rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
}

.control-section h3 {
  font-size: 1rem;
  margin-bottom: 0.75rem;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.unit-toggle {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.unit-toggle button {
  flex: 1;
  padding: 0.5rem;
  border: 2px solid #e0e0e0;
  background: white;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-weight: 500;
  font-size: 0.9rem;
  color: #666;
}

.unit-toggle button:hover {
  border-color: #667eea;
  color: #667eea;
}

.unit-toggle button.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-color: transparent;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
}

.input-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.input-group label {
  flex: 0 0 50px;
  font-size: 0.85rem;
  color: #666;
}

.input-group input {
  flex: 1;
  min-width: 0;
  padding: 0.5rem 0.625rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 0.9rem;
  box-sizing: border-box;
  transition: all 0.3s ease;
  background: white;
}

.input-group input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.input-group span {
  flex: 0 0 35px;
  font-size: 0.85rem;
  color: #666;
}

.apply-btn {
  width: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 0.625rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  margin-top: 0.25rem;
  transition: all 0.3s ease;
  box-shadow: 0 3px 12px rgba(102, 126, 234, 0.3);
}

.apply-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 5px 18px rgba(102, 126, 234, 0.4);
}

.apply-btn:active {
  transform: translateY(0);
}

.format-options {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.format-options label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  padding: 0.375rem 0.5rem;
  border-radius: 6px;
  transition: background 0.2s;
}

.format-options label:hover {
  background: rgba(102, 126, 234, 0.05);
}

.format-options input[type="radio"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.format-options span {
  font-size: 0.9rem;
}

.zoom-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.zoom-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.zoom-controls label {
  flex: 0 0 50px;
  font-size: 0.85rem;
  color: #666;
}

.zoom-btn {
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  padding: 0;
  background: white;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1.1rem;
  font-weight: 600;
  color: #667eea;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.zoom-btn:hover {
  background: #667eea;
  color: white;
  border-color: #667eea;
  transform: scale(1.05);
}

.zoom-btn:active {
  transform: scale(0.95);
}

.zoom-input {
  flex: 0 0 70px;
  min-width: 0;
  padding: 0.5rem 0.625rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 0.9rem;
  text-align: center;
  box-sizing: border-box;
  transition: all 0.3s ease;
  background: white;
}

.zoom-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.zoom-unit {
  flex: 0 0 auto;
  font-size: 0.85rem;
  color: #666;
  margin-right: 0.25rem;
}

.reset-zoom-btn {
  flex: 0 0 auto;
  padding: 0.5rem 1rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: all 0.3s ease;
  white-space: nowrap;
  box-shadow: 0 2px 10px rgba(102, 126, 234, 0.3);
}

.reset-zoom-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.reset-zoom-btn:active {
  transform: translateY(0);
}

.zoom-slider {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: #ddd;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

.zoom-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
}

.zoom-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.5);
}

.zoom-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  cursor: pointer;
  border: none;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
}

.zoom-slider::-moz-range-thumb:hover {
  transform: scale(1.2);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.5);
}

.hint {
  font-size: 0.75rem;
  color: #888;
  margin-top: 0.375rem;
  font-style: italic;
  line-height: 1.3;
}

.history-controls {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.375rem;
}

.history-controls button {
  flex: 1;
  padding: 0.45rem 0.625rem;
  border: 2px solid #e0e0e0;
  background: white;
  border-radius: 7px;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 500;
  transition: all 0.3s ease;
  color: #666;
}

.history-controls button:hover:not(:disabled) {
  background: rgba(102, 126, 234, 0.05);
  border-color: #667eea;
  color: #667eea;
  transform: translateY(-1px);
}

.history-controls button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.history-controls button:active:not(:disabled) {
  transform: translateY(0);
}

@media (max-width: 768px) {
  .header {
    padding: 1rem;
  }
  
  .header h1 {
    font-size: 1.2rem;
  }
  
  .export-btn {
    padding: 0.5rem 1rem;
    font-size: 0.9rem;
  }
  
  .main-content {
    padding: 1rem;
  }
  
  .editor-container {
    flex-direction: column;
  }
  
  .control-panel {
    width: 100%;
  }
  
  .upload-area {
    margin: 2rem auto;
    padding: 3rem 1rem;
  }
}
</style>

@media (max-width: 768px) {
  .header {
    padding: 1rem 1.5rem;
  }
  
  .header h1 {
    font-size: 1.3rem;
  }
  
  .export-btn {
    padding: 0.625rem 1.25rem;
    font-size: 0.9rem;
  }
  
  .main-content {
    padding: 1.5rem;
  }
  
  .editor-container {
    flex-direction: column;
    gap: 1.5rem;
  }
  
  .control-panel {
    width: 100%;
  }
  
  .upload-area {
    margin: 2rem auto;
    padding: 3.5rem 2rem;
  }
  
  .upload-icon {
    font-size: 4rem;
  }
  
  .upload-text {
    font-size: 1.25rem;
  }
}
