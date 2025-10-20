'use client'

import React, { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { GoogleGenerativeAI } from '@google/generative-ai'

interface MathProblem {
  problem_text: string
  final_answer: number
}

export default function Home() {
  const [problem, setProblem] = useState<MathProblem | null>(null)
  const [userAnswer, setUserAnswer] = useState('')
  const [feedback, setFeedback] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)

  const generateProblem = async () => {
    // TODO: Implement problem generation logic
    setIsLoading(true)
    setFeedback('')
    setUserAnswer('')
    setIsCorrect(null)
    setProblem(null)

    try {
      const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GOOGLE_API_KEY)
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

      const prompt = `Generate a math word problem suitable for elementary or middle school students. 
      The problem should be clear, engaging, and have a single numerical answer.
      Return the response in JSON format with the following structure:
      {
        "problem_text": "the full problem description",
        "final_answer": numeric_answer
      }
      Only return the JSON object, no additional text.`

      const result = await model.generateContent(prompt)
      const response = await result.response
      const text = response.text()
      
      // Parse the JSON response from Gemini
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('Invalid response format from AI')
      }
      
      const mathProblem = JSON.parse(jsonMatch[0])

      // Create a new session in the database
      const { data: session, error: sessionError } = await supabase
        .from('math_problem_sessions')
        .insert({
          problem_text: mathProblem.problem_text,
          correct_answer: mathProblem.final_answer
        })
        .select()
        .single()

      if (sessionError) {
        throw sessionError
      }

      setProblem({
        problem_text: mathProblem.problem_text,
        final_answer: mathProblem.final_answer
      })
      setSessionId(session.id)

    } catch (error) {
      console.error('Error:', error)
      setFeedback('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const submitAnswer = async (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Implement answer submission logic
    if (!sessionId || !userAnswer || !problem) return

    setIsLoading(true)
    
    try {
      const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GOOGLE_API_KEY!)
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

      // Check if answer is correct
      const correct = Number(userAnswer) === problem.final_answer
      setIsCorrect(correct)

      // Generate feedback using Gemini
      const feedbackPrompt = `A student answered a math problem. 
      Problem: ${problem.problem_text}
      Correct answer: ${problem.final_answer}
      Student's answer: ${userAnswer}
      Is correct: ${correct}
      
      Generate encouraging feedback for the student. If correct, congratulate them and explain the solution briefly. If incorrect, gently explain what went wrong and guide them to the correct answer. Keep it friendly and educational.`

      const result = await model.generateContent(feedbackPrompt)
      const response = await result.response
      const feedbackText = response.text()

      // Save submission to database
      const { error: submissionError } = await supabase
        .from('math_problem_submissions')
        .insert({
          session_id: sessionId,
          user_answer: Number(userAnswer),
          is_correct: correct,
          feedback_text: feedbackText
        })

      if (submissionError) {
        throw submissionError
      }

      setFeedback(feedbackText)

    } catch (error) {
      console.error('Error:', error)
      setFeedback('An error occurred while submitting your answer. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-800">
          Math Problem Generator
        </h1>
        
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <button
            onClick={generateProblem}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition duration-200 ease-in-out transform hover:scale-105"
          >
            {isLoading ? 'Generating...' : 'Generate New Problem'}
          </button>
        </div>
        
        {problem && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-700">Problem:</h2>
            <p className="text-lg text-gray-800 leading-relaxed mb-6">
              {problem.problem_text}
            </p>
            
            <form onSubmit={submitAnswer} className="space-y-4">
              <div>
                <label htmlFor="answer" className="block text-sm font-medium text-gray-700 mb-2">
                  Your Answer:
                </label>
                <input
                  type="number"
                  id="answer"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                  placeholder="Enter your answer"
                  required
                />
              </div>
              
              <button
                type="submit"
                disabled={!userAnswer || isLoading}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition duration-200 ease-in-out transform hover:scale-105"
              >
                Submit Answer
              </button>
            </form>
          </div>
        )}

        {feedback && (
          <div className={`rounded-lg shadow-lg p-6 ${isCorrect ? 'bg-green-50 border-2 border-green-200' : 'bg-yellow-50 border-2 border-yellow-200'}`}>
            <h2 className="text-xl font-semibold mb-4 text-gray-700">
              {isCorrect ? '✅ Correct!' : '❌ Not quite right'}
            </h2>
            <p className="text-gray-800 leading-relaxed">{feedback}</p>
          </div>
        )}
      </main>
    </div>
  )
}