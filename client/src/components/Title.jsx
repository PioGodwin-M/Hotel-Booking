import React from 'react'

const Title = ({title,subTitle,align,font}) => {
  return (
    <div className={`flex flex-col justify-center items-center text-center ${align === "left" && "md:items-start md:text-left"}`}>
      <h1 className={`text-3xl md:text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100 ${font || ""}`}>{title}</h1>
      <p className='text-sm md:text-base text-gray-500/90 mt-2 max-w-174'>{subTitle}</p>
    </div>
  )
}

export default Title
