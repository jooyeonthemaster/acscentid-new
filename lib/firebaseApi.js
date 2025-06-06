import { db } from './firebase';
import { ref, set, push, get, update, serverTimestamp } from 'firebase/database';

// 데이터 검증 및 정리 함수
const sanitizeData = (data) => {
  if (data === null || data === undefined) {
    return null;
  }
  
  if (typeof data === 'object' && !Array.isArray(data)) {
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null) {
        if (typeof value === 'object' && !Array.isArray(value)) {
          const nestedSanitized = sanitizeData(value);
          if (nestedSanitized && Object.keys(nestedSanitized).length > 0) {
            sanitized[key] = nestedSanitized;
          }
        } else if (Array.isArray(value)) {
          const arrayFiltered = value.filter(item => item !== undefined && item !== null);
          if (arrayFiltered.length > 0) {
            sanitized[key] = arrayFiltered.map(item => sanitizeData(item));
          }
        } else {
          sanitized[key] = value;
        }
      }
    }
    return Object.keys(sanitized).length > 0 ? sanitized : null;
  }
  
  if (Array.isArray(data)) {
    const filtered = data.filter(item => item !== undefined && item !== null);
    return filtered.map(item => sanitizeData(item));
  }
  
  return data;
};

// Firebase 권한 오류 처리 함수
const handleFirebaseError = (error, operation) => {
  console.error(`Firebase ${operation} 오류:`, error);
  
  if (error.code === 'PERMISSION_DENIED') {
    console.warn('Firebase 권한 오류 - 개발 모드에서는 무시하고 계속 진행합니다.');
    return { warning: 'Permission denied - continuing in development mode' };
  }
  
  throw error;
};

// 안전한 Firebase 업데이트 함수
const safeUpdate = async (ref, data, operation = 'update') => {
  try {
    const sanitizedData = sanitizeData(data);
    if (!sanitizedData || Object.keys(sanitizedData).length === 0) {
      console.warn(`${operation}: 저장할 유효한 데이터가 없습니다.`);
      return { warning: 'No valid data to save' };
    }
    
    await update(ref, sanitizedData);
    return { success: true };
  } catch (error) {
    return handleFirebaseError(error, operation);
  }
};

// 안전한 Firebase 설정 함수
const safeSet = async (ref, data, operation = 'set') => {
  try {
    const sanitizedData = sanitizeData(data);
    if (!sanitizedData) {
      console.warn(`${operation}: 저장할 유효한 데이터가 없습니다.`);
      return { warning: 'No valid data to save' };
    }
    
    await set(ref, sanitizedData);
    return { success: true, key: ref.key };
  } catch (error) {
    return handleFirebaseError(error, operation);
  }
};

// 이미지 분석 결과 저장 함수 (예시)
export const saveImageAnalysis = async (userId, analysisData) => {
  try {
    const analysesRef = ref(db, `users/${userId}/imageAnalyses`);
    const newAnalysisRef = push(analysesRef); // 새로운 고유 키 생성
    await set(newAnalysisRef, {
      ...analysisData,
      timestamp: serverTimestamp(), // 서버 시간 기준으로 타임스탬프 기록
    });
    console.log('Image analysis saved successfully with id: ', newAnalysisRef.key);
    return newAnalysisRef.key; // 저장된 데이터의 키 반환
  } catch (error) {
    console.error('Error saving image analysis: ', error);
    throw error;
  }
};

// 이미지 분석 기반 향수 추천 저장 함수
export const savePerfumeRecommendation = async (userId, analysisId, recommendationData) => {
  try {
    const recommendationsRef = ref(db, `users/${userId}/perfumeRecommendations`);
    const newRecommendationRef = push(recommendationsRef);
    await set(newRecommendationRef, {
      basedOnAnalysisId: analysisId, // 어떤 분석 결과를 기반으로 추천했는지 ID 저장
      ...recommendationData, // 예: { recommendedPerfumes: ['향수A', '향수B'], reason: '...', otherDetails: {} }
      timestamp: serverTimestamp(),
    });
    console.log('Perfume recommendation saved successfully with id: ', newRecommendationRef.key);
    return newRecommendationRef.key;
  } catch (error) {
    console.error('Error saving perfume recommendation: ', error);
    throw error;
  }
};

// 피드백 저장 함수
export const saveFeedback = async (userId, recommendationId, feedbackData) => {
  try {
    const feedbacksRef = ref(db, `users/${userId}/feedbacks`);
    const newFeedbackRef = push(feedbacksRef);
    await set(newFeedbackRef, {
      basedOnRecommendationId: recommendationId, // 어떤 향수 추천에 대한 피드백인지 ID 저장
      ...feedbackData, // 예: { rating: 5, comment: '...', likedPerfumes: [], dislikedPerfumes: [] }
      timestamp: serverTimestamp(),
    });
    console.log('Feedback saved successfully with id: ', newFeedbackRef.key);
    return newFeedbackRef.key;
  } catch (error) {
    console.error('Error saving feedback: ', error);
    throw error;
  }
};

// 피드백 기반 테스팅 향 추천 저장 함수
export const saveTestingRecommendation = async (userId, feedbackId, testingRecommendationData) => {
  try {
    const testingRecsRef = ref(db, `users/${userId}/testingRecommendations`);
    const newTestingRecRef = push(testingRecsRef);
    await set(newTestingRecRef, {
      basedOnFeedbackId: feedbackId, // 어떤 피드백을 기반으로 추천했는지 ID 저장
      ...testingRecommendationData, // 예: { recommendedPerfumes: ['향수C', '향수D'], reason: '...' }
      timestamp: serverTimestamp(),
    });
    console.log('Testing recommendation saved successfully with id: ', newTestingRecRef.key);
    return newTestingRecRef.key;
  } catch (error) {
    console.error('Error saving testing recommendation: ', error);
    throw error;
  }
};

// 세션 생성 함수 (전체 플로우의 시작)
export const createPerfumeSession = async (userId, sessionData) => {
  try {
    const sessionsRef = ref(db, `users/${userId}/perfumeSessions`);
    const newSessionRef = push(sessionsRef);
    await set(newSessionRef, {
      ...sessionData,
      sessionId: newSessionRef.key,
      status: 'started', // started, image_analyzed, feedback_given, recipe_created, confirmed
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    console.log('향수 세션 생성 완료:', newSessionRef.key);
    return newSessionRef.key;
  } catch (error) {
    console.error('향수 세션 생성 오류:', error);
    throw error;
  }
};

// 이미지 분석 결과 및 이미지 링크 저장 함수 (개선)
export const saveImageAnalysisWithLink = async (userId, sessionId, analysisData, imageUrl) => {
  try {
    console.log('🔥 saveImageAnalysisWithLink 호출됨:', { userId, sessionId, hasAnalysisData: !!analysisData, imageUrl });
    
    // 데이터 검증 및 정리
    const sanitizedAnalysis = sanitizeData(analysisData);
    if (!sanitizedAnalysis) {
      console.warn('이미지 분석 데이터가 비어있거나 유효하지 않습니다.');
      return { warning: 'No valid analysis data' };
    }
    
    const sessionRef = ref(db, `users/${userId}/perfumeSessions/${sessionId}`);
    
    // 먼저 세션이 존재하는지 확인 (안전한 방식으로)
    let sessionSnapshot;
    try {
      sessionSnapshot = await get(sessionRef);
    } catch (getError) {
      console.warn('세션 조회 중 오류 발생:', getError);
      sessionSnapshot = { exists: () => false }; // 기본값
    }
    
    let sessionResult;
    if (!sessionSnapshot.exists()) {
      // 세션이 존재하지 않으면 새로 생성
      console.log('세션이 존재하지 않아 새로 생성합니다:', sessionId);
      const newSessionData = {
        sessionId: sessionId,
        userId: userId,
        status: 'image_analyzed',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        imageUrl: imageUrl,
        imageAnalysis: sanitizedAnalysis,
      };
      sessionResult = await safeSet(sessionRef, newSessionData, 'new session creation');
    } else {
      // 세션이 존재하면 업데이트
      console.log('기존 세션을 업데이트합니다:', sessionId);
      const updateData = {
        imageUrl: imageUrl,
        imageAnalysis: sanitizedAnalysis,
        status: 'image_analyzed',
        updatedAt: serverTimestamp(),
      };
      sessionResult = await safeUpdate(sessionRef, updateData, 'session image analysis update');
    }
    
    // 별도로 이미지 분석 기록도 저장
    const analysesRef = ref(db, `users/${userId}/imageAnalyses`);
    const newAnalysisRef = push(analysesRef);
    const analysisRecord = {
      sessionId: sessionId,
      imageUrl: imageUrl,
      ...sanitizedAnalysis,
      timestamp: serverTimestamp(),
    };
    
    const analysisResult = await safeSet(newAnalysisRef, analysisRecord, 'analysis record');
    
    console.log('🔥 이미지 분석 및 링크 저장 완료:', {
      sessionResult,
      analysisResult
    });
    
    return { 
      sessionUpdated: sessionResult.success || sessionResult.warning,
      analysisId: analysisResult.key || 'warning-mode',
      warnings: [sessionResult.warning, analysisResult.warning].filter(Boolean)
    };
  } catch (error) {
    console.error('🔥 이미지 분석 저장 오류:', error);
    return handleFirebaseError(error, 'save image analysis');
  }
};

// 세션별 피드백 저장 함수
export const saveSessionFeedback = async (userId, sessionId, feedbackData) => {
  try {
    console.log('🔥 saveSessionFeedback 호출됨:', { userId, sessionId, feedbackDataKeys: Object.keys(feedbackData || {}) });
    
    // 데이터 검증 및 정리
    const sanitizedFeedback = sanitizeData(feedbackData);
    if (!sanitizedFeedback) {
      console.warn('피드백 데이터가 비어있거나 유효하지 않습니다.');
      return { warning: 'No valid feedback data' };
    }
    
    console.log('🔥 정리된 피드백 데이터:', {
      keys: Object.keys(sanitizedFeedback),
      hasPerfumeName: !!sanitizedFeedback.perfumeName,
      perfumeName: sanitizedFeedback.perfumeName
    });
    
    const sessionRef = ref(db, `users/${userId}/perfumeSessions/${sessionId}`);
    const sessionUpdateResult = await safeUpdate(sessionRef, {
      feedback: sanitizedFeedback,
      status: 'feedback_given',
      updatedAt: serverTimestamp(),
    }, 'session feedback update');
    
    // 별도로 피드백 기록도 저장
    const feedbacksRef = ref(db, `users/${userId}/feedbacks`);
    const newFeedbackRef = push(feedbacksRef);
    const feedbackRecord = {
      sessionId: sessionId,
      ...sanitizedFeedback,
      timestamp: serverTimestamp(),
    };
    
    const feedbackSetResult = await safeSet(newFeedbackRef, feedbackRecord, 'feedback record');
    
    console.log('🔥 세션 피드백 저장 완료:', { 
      sessionUpdate: sessionUpdateResult, 
      feedbackRecord: feedbackSetResult 
    });
    
    return { 
      sessionUpdated: sessionUpdateResult.success || sessionUpdateResult.warning, 
      feedbackId: feedbackSetResult.key || 'warning-mode',
      warnings: [sessionUpdateResult.warning, feedbackSetResult.warning].filter(Boolean)
    };
  } catch (error) {
    console.error('🔥 세션 피드백 저장 오류:', error);
    return handleFirebaseError(error, 'save session feedback');
  }
};

// 개선된 레시피 저장 함수
export const saveImprovedRecipe = async (userId, sessionId, recipeData) => {
  try {
    console.log('🔥 saveImprovedRecipe 호출됨:', { userId, sessionId, recipeDataKeys: Object.keys(recipeData || {}) });
    
    // 데이터 검증 및 정리
    const sanitizedRecipe = sanitizeData(recipeData);
    if (!sanitizedRecipe) {
      console.warn('레시피 데이터가 비어있거나 유효하지 않습니다.');
      return { warning: 'No valid recipe data' };
    }
    
    console.log('🔥 정리된 레시피 데이터:', {
      keys: Object.keys(sanitizedRecipe),
      hasOriginalPerfumeId: !!sanitizedRecipe.originalPerfumeId,
      hasImprovedRecipe: !!sanitizedRecipe.improvedRecipe
    });
    
    const sessionRef = ref(db, `users/${userId}/perfumeSessions/${sessionId}`);
    const sessionUpdateResult = await safeUpdate(sessionRef, {
      improvedRecipe: sanitizedRecipe,
      status: 'recipe_created',
      updatedAt: serverTimestamp(),
    }, 'session recipe update');
    
    // 별도로 레시피 기록도 저장
    const recipesRef = ref(db, `users/${userId}/recipes`);
    const newRecipeRef = push(recipesRef);
    const recipeToSave = {
      sessionId: sessionId,
      ...sanitizedRecipe,
      timestamp: serverTimestamp(),
    };
    
    console.log('🔥 recipes 컬렉션에 저장할 데이터:', {
      recipeId: newRecipeRef.key,
      sessionId: sessionId,
      originalPerfumeId: sanitizedRecipe.originalPerfumeId,
      originalPerfumeName: sanitizedRecipe.originalPerfumeName
    });
    
    const recipeSetResult = await safeSet(newRecipeRef, recipeToSave, 'recipe record');
    
    console.log('🔥 개선된 레시피 저장 완료:', {
      sessionUpdate: sessionUpdateResult,
      recipeRecord: recipeSetResult
    });
    
    return { 
      sessionUpdated: sessionUpdateResult.success || sessionUpdateResult.warning,
      recipeId: recipeSetResult.key || 'warning-mode',
      warnings: [sessionUpdateResult.warning, recipeSetResult.warning].filter(Boolean)
    };
  } catch (error) {
    console.error('🔥 개선된 레시피 저장 오류:', error);
    return handleFirebaseError(error, 'save improved recipe');
  }
};

// 향 확정 함수
export const confirmPerfume = async (userId, sessionId, confirmationData) => {
  try {
    const sessionRef = ref(db, `users/${userId}/perfumeSessions/${sessionId}`);
    await update(sessionRef, {
      confirmation: {
        ...confirmationData,
        confirmedAt: serverTimestamp(),
      },
      status: 'confirmed',
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    // 별도로 확정된 향수 기록도 저장
    const confirmedPerfumesRef = ref(db, `users/${userId}/confirmedPerfumes`);
    const newConfirmationRef = push(confirmedPerfumesRef);
    await set(newConfirmationRef, {
      sessionId: sessionId,
      ...confirmationData,
      timestamp: serverTimestamp(),
    });
    
    console.log('향수 확정 완료');
    return { sessionCompleted: true, confirmationId: newConfirmationRef.key };
  } catch (error) {
    console.error('향수 확정 오류:', error);
    throw error;
  }
};

// 세션 조회 함수
export const getPerfumeSession = async (userId, sessionId) => {
  try {
    const sessionRef = ref(db, `users/${userId}/perfumeSessions/${sessionId}`);
    const snapshot = await get(sessionRef);
    if (snapshot.exists()) {
      return snapshot.val();
    } else {
      throw new Error('세션을 찾을 수 없습니다.');
    }
  } catch (error) {
    console.error('세션 조회 오류:', error);
    throw error;
  }
};

// 사용자의 모든 세션 조회 함수
export const getUserSessions = async (userId) => {
  try {
    const sessionsRef = ref(db, `users/${userId}/perfumeSessions`);
    const snapshot = await get(sessionsRef);
    if (snapshot.exists()) {
      return snapshot.val();
    } else {
      return {};
    }
  } catch (error) {
    console.error('사용자 세션 조회 오류:', error);
    throw error;
  }
};

// 관리자용: 모든 사용자 데이터 조회 함수
export const getAllUserData = async () => {
  try {
    const usersRef = ref(db, 'users');
    const snapshot = await get(usersRef);
    if (snapshot.exists()) {
      return snapshot.val();
    } else {
      return {};
    }
  } catch (error) {
    console.error('모든 사용자 데이터 조회 오류:', error);
    throw error;
  }
};

// 관리자용: 특정 세션의 전체 데이터 조회 함수
export const getSessionFullData = async (userId, sessionId) => {
  try {
    // 세션 기본 정보
    const sessionRef = ref(db, `users/${userId}/perfumeSessions/${sessionId}`);
    const sessionSnapshot = await get(sessionRef);
    
    // 관련 이미지 분석 데이터
    const analysesRef = ref(db, `users/${userId}/imageAnalyses`);
    const analysesSnapshot = await get(analysesRef);
    
    // 관련 피드백 데이터
    const feedbacksRef = ref(db, `users/${userId}/feedbacks`);
    const feedbacksSnapshot = await get(feedbacksRef);
    
    // 관련 레시피 데이터
    const recipesRef = ref(db, `users/${userId}/recipes`);
    const recipesSnapshot = await get(recipesRef);
    
    // 관련 확정 데이터
    const confirmedRef = ref(db, `users/${userId}/confirmedPerfumes`);
    const confirmedSnapshot = await get(confirmedRef);
    
    const result = {
      session: sessionSnapshot.exists() ? sessionSnapshot.val() : null,
      analyses: [],
      feedbacks: [],
      recipes: [],
      confirmed: []
    };
    
    // sessionId와 일치하는 데이터만 필터링
    if (analysesSnapshot.exists()) {
      const analyses = analysesSnapshot.val();
      result.analyses = Object.keys(analyses)
        .filter(key => analyses[key].sessionId === sessionId)
        .map(key => ({ id: key, ...analyses[key] }));
    }
    
    if (feedbacksSnapshot.exists()) {
      const feedbacks = feedbacksSnapshot.val();
      result.feedbacks = Object.keys(feedbacks)
        .filter(key => feedbacks[key].sessionId === sessionId)
        .map(key => ({ id: key, ...feedbacks[key] }));
    }
    
    if (recipesSnapshot.exists()) {
      const recipes = recipesSnapshot.val();
      result.recipes = Object.keys(recipes)
        .filter(key => recipes[key].sessionId === sessionId)
        .map(key => ({ id: key, ...recipes[key] }));
    }
    
    if (confirmedSnapshot.exists()) {
      const confirmed = confirmedSnapshot.val();
      result.confirmed = Object.keys(confirmed)
        .filter(key => confirmed[key].sessionId === sessionId)
        .map(key => ({ id: key, ...confirmed[key] }));
    }
    
    return result;
  } catch (error) {
    console.error('세션 전체 데이터 조회 오류:', error);
    throw error;
  }
};



// 세션별 레시피 히스토리 조회 함수
export const getSessionRecipes = async (userId, sessionId) => {
  try {
    console.log('🔍 getSessionRecipes 호출됨:', { userId, sessionId });
    
    const recipesRef = ref(db, `users/${userId}/recipes`);
    const snapshot = await get(recipesRef);
    
    if (snapshot.exists()) {
      const allRecipes = snapshot.val();
      console.log('🔍 전체 레시피 데이터:', {
        totalRecipes: Object.keys(allRecipes).length,
        recipeIds: Object.keys(allRecipes),
        sessionIds: Object.keys(allRecipes).map(key => ({ id: key, sessionId: allRecipes[key].sessionId }))
      });
      
      const sessionRecipes = Object.keys(allRecipes)
        .filter(key => {
          const recipeSessionId = allRecipes[key].sessionId;
          const match = recipeSessionId === sessionId;
          console.log('🔍 세션 매칭 체크:', { recipeId: key, recipeSessionId, targetSessionId: sessionId, match });
          return match;
        })
        .map(key => ({ 
          id: key, 
          ...allRecipes[key],
          createdAt: allRecipes[key].timestamp || allRecipes[key].generatedAt
        }))
        .sort((a, b) => {
          // 타임스탬프로 최신순 정렬
          const timeA = a.createdAt || 0;
          const timeB = b.createdAt || 0;
          return timeB - timeA;
        });
      
      console.log(`🔍 세션 ${sessionId}의 레시피 ${sessionRecipes.length}개 조회 완료`);
      return sessionRecipes;
    } else {
      console.log('🔍 레시피 데이터가 없습니다.');
      return [];
    }
  } catch (error) {
    console.error('🔍 세션 레시피 조회 오류:', error);
    throw error;
  }
};

// 특정 레시피 상세 조회 함수
export const getRecipeById = async (userId, recipeId) => {
  try {
    const recipeRef = ref(db, `users/${userId}/recipes/${recipeId}`);
    const snapshot = await get(recipeRef);
    
    if (snapshot.exists()) {
      return { id: recipeId, ...snapshot.val() };
    } else {
      throw new Error('레시피를 찾을 수 없습니다.');
    }
  } catch (error) {
    console.error('레시피 상세 조회 오류:', error);
    throw error;
  }
};

// 선택한 레시피를 세션의 현재 레시피로 설정하는 함수
export const setSessionActiveRecipe = async (userId, sessionId, recipeData) => {
  try {
    const sessionRef = ref(db, `users/${userId}/perfumeSessions/${sessionId}`);
    await update(sessionRef, {
      improvedRecipe: {
        ...recipeData,
        selectedFromHistory: true,
        reactivatedAt: serverTimestamp()
      },
      status: 'recipe_selected',
      updatedAt: serverTimestamp(),
    });
    
    console.log('세션의 활성 레시피 설정 완료');
    return { success: true, message: '이전 레시피가 활성화되었습니다.' };
  } catch (error) {
    console.error('활성 레시피 설정 오류:', error);
    throw error;
  }
};

// 레시피 즐겨찾기/북마크 기능
export const toggleRecipeBookmark = async (userId, recipeId, isBookmarked) => {
  try {
    const recipeRef = ref(db, `users/${userId}/recipes/${recipeId}`);
    await update(recipeRef, {
      isBookmarked: isBookmarked,
      bookmarkedAt: isBookmarked ? serverTimestamp() : null,
    });
    
    console.log(`레시피 북마크 ${isBookmarked ? '추가' : '제거'} 완료`);
    return { success: true, isBookmarked };
  } catch (error) {
    console.error('레시피 북마크 오류:', error);
    throw error;
  }
}; 