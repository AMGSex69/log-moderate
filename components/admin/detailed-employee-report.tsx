��" u s e   c l i e n t "  
  
 i m p o r t   {   u s e S t a t e ,   u s e E f f e c t   }   f r o m   " r e a c t "  
 i m p o r t   {   C a r d ,   C a r d C o n t e n t ,   C a r d D e s c r i p t i o n ,   C a r d H e a d e r ,   C a r d T i t l e   }   f r o m   " @ / c o m p o n e n t s / u i / c a r d "  
 i m p o r t   {   B a d g e   }   f r o m   " @ / c o m p o n e n t s / u i / b a d g e "  
 i m p o r t   {   B u t t o n   }   f r o m   " @ / c o m p o n e n t s / u i / b u t t o n "  
 i m p o r t   {   C a l e n d a r   }   f r o m   " @ / c o m p o n e n t s / u i / c a l e n d a r "  
 i m p o r t   {   P o p o v e r ,   P o p o v e r C o n t e n t ,   P o p o v e r T r i g g e r   }   f r o m   " @ / c o m p o n e n t s / u i / p o p o v e r "  
 i m p o r t   {   s u p a b a s e   }   f r o m   " @ / l i b / s u p a b a s e "  
 i m p o r t   {   g e t T a s k G r o u p   }   f r o m   " @ / l i b / g a m e - c o n f i g "  
 i m p o r t   {  
 	 C a l e n d a r I c o n ,  
 	 C l o c k ,  
 	 T a r g e t ,  
 	 U s e r ,  
 	 B a r C h a r t 3 ,  
 	 A l e r t T r i a n g l e ,  
 	 C h e c k C i r c l e 2 ,  
 	 X C i r c l e  
 }   f r o m   " l u c i d e - r e a c t "  
 i m p o r t   {   f o r m a t   }   f r o m   " d a t e - f n s "  
 i m p o r t   {   r u   }   f r o m   " d a t e - f n s / l o c a l e "  
  
 i n t e r f a c e   E m p l o y e e W o r k L o g   {  
 	 e m p l o y e e _ i d :   s t r i n g  
 	 f u l l _ n a m e :   s t r i n g  
 	 p o s i t i o n :   s t r i n g  
 	 t o t a l _ t a s k s :   n u m b e r  
 	 t o t a l _ u n i t s :   n u m b e r  
 	 t o t a l _ t i m e :   n u m b e r  
 	 c o m p l e t i o n _ p e r c e n t a g e :   n u m b e r  
 	 s t a t u s :   ' n o r m a l '   |   ' c r i t i c a l _ u n d e r w o r k '   |   ' c l o s e _ t o _ n o r m '   |   ' e x c e e d _ n o r m '  
 	 t a s k _ b r e a k d o w n :   {  
 	 	 t a s k _ n a m e :   s t r i n g  
 	 	 u n i t s :   n u m b e r  
 	 	 t i m e :   n u m b e r  
 	 	 p e r c e n t a g e :   n u m b e r  
 	 } [ ]  
 }  
  
 e x p o r t   d e f a u l t   f u n c t i o n   D e t a i l e d E m p l o y e e R e p o r t ( )   {  
 	 c o n s t   [ s e l e c t e d D a t e ,   s e t S e l e c t e d D a t e ]   =   u s e S t a t e < D a t e > ( n e w   D a t e ( ) )  
 	 c o n s t   [ r e p o r t D a t a ,   s e t R e p o r t D a t a ]   =   u s e S t a t e < {  
 	 	 t o t a l _ e m p l o y e e s :   n u m b e r  
 	 	 w o r k i n g _ e m p l o y e e s :   n u m b e r  
 	 	 t o t a l _ u n i t s :   n u m b e r  
 	 	 m z h i _ d e c i s i o n s :   n u m b e r  
 	 	 e m p l o y e e _ l o g s :   E m p l o y e e W o r k L o g [ ]  
 	 }   |   n u l l > ( n u l l )  
 	 c o n s t   [ l o a d i n g ,   s e t L o a d i n g ]   =   u s e S t a t e ( f a l s e )  
  
 	 u s e E f f e c t ( ( )   = >   {  
 	 	 l o a d R e p o r t D a t a ( )  
 	 } ,   [ s e l e c t e d D a t e ] )  
  
 	 c o n s t   l o a d R e p o r t D a t a   =   a s y n c   ( )   = >   {  
 	 	 s e t L o a d i n g ( t r u e )  
 	 	 t r y   {  
 	 	 	 c o n s t   d a t e S t r   =   f o r m a t ( s e l e c t e d D a t e ,   ' y y y y - M M - d d ' )  
  
 	 	 	 c o n s t   {   d a t a :   e m p l o y e e s   }   =   a w a i t   s u p a b a s e  
 	 	 	 	 . f r o m ( " e m p l o y e e s " )  
 	 	 	 	 . s e l e c t ( " i d ,   f u l l _ n a m e ,   p o s i t i o n ,   w o r k _ h o u r s " )  
 	 	 	 	 . e q ( " i s _ a c t i v e " ,   t r u e )  
  
 	 	 	 i f   ( ! e m p l o y e e s )   r e t u r n  
  
 	 	 	 c o n s t   {   d a t a :   t a s k L o g s   }   =   a w a i t   s u p a b a s e  
 	 	 	 	 . f r o m ( " t a s k _ l o g s " )  
 	 	 	 	 . s e l e c t ( `  
                     * ,  
                     e m p l o y e e s ! i n n e r ( f u l l _ n a m e ,   p o s i t i o n ) ,  
                     t a s k _ t y p e s ! i n n e r ( n a m e )  
                 ` )  
 	 	 	 	 . e q ( " w o r k _ d a t e " ,   d a t e S t r )  
 	 	 	 	 . i n ( " e m p l o y e e _ i d " ,   e m p l o y e e s . m a p ( e m p   = >   e m p . i d ) )  
  
 	 	 	 c o n s t   e m p l o y e e L o g s :   E m p l o y e e W o r k L o g [ ]   =   e m p l o y e e s . m a p ( e m p l o y e e   = >   {  
 	 	 	 	 c o n s t   e m p l o y e e T a s k s   =   t a s k L o g s ? . f i l t e r ( l o g   = >   l o g . e m p l o y e e _ i d   = = =   e m p l o y e e . i d )   | |   [ ]  
  
 	 	 	 	 c o n s t   t o t a l T a s k s   =   e m p l o y e e T a s k s . l e n g t h  
 	 	 	 	 c o n s t   t o t a l U n i t s   =   e m p l o y e e T a s k s . r e d u c e ( ( s u m ,   t a s k )   = >   s u m   +   t a s k . u n i t s _ c o m p l e t e d ,   0 )  
 	 	 	 	 c o n s t   t o t a l T i m e   =   e m p l o y e e T a s k s . r e d u c e ( ( s u m ,   t a s k )   = >   s u m   +   t a s k . t i m e _ s p e n t _ m i n u t e s ,   0 )  
 	 	 	 	 c o n s t   w o r k N o r m M i n u t e s   =   ( e m p l o y e e . w o r k _ h o u r s   | |   8 )   *   6 0  
 	 	 	 	 c o n s t   c o m p l e t i o n P e r c e n t a g e   =   M a t h . r o u n d ( ( t o t a l T i m e   /   w o r k N o r m M i n u t e s )   *   1 0 0 )  
  
 	 	 	 	 l e t   s t a t u s :   E m p l o y e e W o r k L o g [ ' s t a t u s ' ]   =   ' n o r m a l '  
 	 	 	 	 i f   ( c o m p l e t i o n P e r c e n t a g e   <   5 0 )   {  
 	 	 	 	 	 s t a t u s   =   ' c r i t i c a l _ u n d e r w o r k '  
 	 	 	 	 }   e l s e   i f   ( c o m p l e t i o n P e r c e n t a g e   <   8 0 )   {  
 	 	 	 	 	 s t a t u s   =   ' c l o s e _ t o _ n o r m '  
 	 	 	 	 }   e l s e   i f   ( c o m p l e t i o n P e r c e n t a g e   >   1 2 0 )   {  
 	 	 	 	 	 s t a t u s   =   ' e x c e e d _ n o r m '  
 	 	 	 	 }  
  
 	 	 	 	 c o n s t   t a s k B r e a k d o w n M a p   =   n e w   M a p ( )  
 	 	 	 	 e m p l o y e e T a s k s . f o r E a c h ( t a s k   = >   {  
 	 	 	 	 	 c o n s t   t a s k N a m e   =   t a s k . t a s k _ t y p e s . n a m e  
 	 	 	 	 	 c o n s t   e x i s t i n g   =   t a s k B r e a k d o w n M a p . g e t ( t a s k N a m e )   | |   {  
 	 	 	 	 	 	 t a s k _ n a m e :   t a s k N a m e ,  
 	 	 	 	 	 	 u n i t s :   0 ,  
 	 	 	 	 	 	 t i m e :   0 ,  
 	 	 	 	 	 	 p e r c e n t a g e :   0  
 	 	 	 	 	 }  
  
 	 	 	 	 	 e x i s t i n g . u n i t s   + =   t a s k . u n i t s _ c o m p l e t e d  
 	 	 	 	 	 e x i s t i n g . t i m e   + =   t a s k . t i m e _ s p e n t _ m i n u t e s  
  
 	 	 	 	 	 t a s k B r e a k d o w n M a p . s e t ( t a s k N a m e ,   e x i s t i n g )  
 	 	 	 	 } )  
  
 	 	 	 	 c o n s t   t a s k B r e a k d o w n   =   A r r a y . f r o m ( t a s k B r e a k d o w n M a p . v a l u e s ( ) ) . m a p ( t a s k   = >   ( {  
 	 	 	 	 	 . . . t a s k ,  
 	 	 	 	 	 p e r c e n t a g e :   t o t a l T i m e   >   0   ?   M a t h . r o u n d ( ( t a s k . t i m e   /   t o t a l T i m e )   *   1 0 0 )   :   0  
 	 	 	 	 } ) ) . s o r t ( ( a ,   b )   = >   b . t i m e   -   a . t i m e )  
  
 	 	 	 	 r e t u r n   {  
 	 	 	 	 	 e m p l o y e e _ i d :   e m p l o y e e . i d ,  
 	 	 	 	 	 f u l l _ n a m e :   e m p l o y e e . f u l l _ n a m e ,  
 	 	 	 	 	 p o s i t i o n :   e m p l o y e e . p o s i t i o n ,  
 	 	 	 	 	 t o t a l _ t a s k s :   t o t a l T a s k s ,  
 	 	 	 	 	 t o t a l _ u n i t s :   t o t a l U n i t s ,  
 	 	 	 	 	 t o t a l _ t i m e :   t o t a l T i m e ,  
 	 	 	 	 	 c o m p l e t i o n _ p e r c e n t a g e :   c o m p l e t i o n P e r c e n t a g e ,  
 	 	 	 	 	 s t a t u s ,  
 	 	 	 	 	 t a s k _ b r e a k d o w n :   t a s k B r e a k d o w n  
 	 	 	 	 }  
 	 	 	 } )  
  
 	 	 	 c o n s t   m z h i D e c i s i o n s   =   t a s k L o g s ? . f i l t e r ( l o g   = >  
 	 	 	 	 l o g . t a s k _ t y p e s . n a m e   = = =   " =5A5=85  @5H5=89    ( :>;- 2>  1;0=:>2) "  
 	 	 	 ) . r e d u c e ( ( s u m ,   l o g )   = >   s u m   +   l o g . u n i t s _ c o m p l e t e d ,   0 )   | |   0  
  
 	 	 	 s e t R e p o r t D a t a ( {  
 	 	 	 	 t o t a l _ e m p l o y e e s :   e m p l o y e e s . l e n g t h ,  
 	 	 	 	 w o r k i n g _ e m p l o y e e s :   e m p l o y e e L o g s . f i l t e r ( l o g   = >   l o g . t o t a l _ t a s k s   >   0 ) . l e n g t h ,  
 	 	 	 	 t o t a l _ u n i t s :   e m p l o y e e L o g s . r e d u c e ( ( s u m ,   l o g )   = >   s u m   +   l o g . t o t a l _ u n i t s ,   0 ) ,  
 	 	 	 	 m z h i _ d e c i s i o n s :   m z h i D e c i s i o n s ,  
 	 	 	 	 e m p l o y e e _ l o g s :   e m p l o y e e L o g s . s o r t ( ( a ,   b )   = >   b . t o t a l _ u n i t s   -   a . t o t a l _ u n i t s )  
 	 	 	 } )  
  
 	 	 }   c a t c h   ( e r r o r )   {  
 	 	 	 c o n s o l e . e r r o r ( " H81:0  703@C7:8  >BG5B0: " ,   e r r o r )  
 	 	 }   f i n a l l y   {  
 	 	 	 s e t L o a d i n g ( f a l s e )  
 	 	 }  
 	 }  
  
 	 c o n s t   f o r m a t T i m e   =   ( m i n u t e s :   n u m b e r )   = >   {  
 	 	 c o n s t   h o u r s   =   M a t h . f l o o r ( m i n u t e s   /   6 0 )  
 	 	 c o n s t   m i n s   =   m i n u t e s   %   6 0  
 	 	 r e t u r n   h o u r s   >   0   ?   ` $ { h o u r s } G  $ { m i n s } <`   :   ` $ { m i n s } <`  
 	 }  
  
 	 c o n s t   g e t S t a t u s C o l o r   =   ( s t a t u s :   E m p l o y e e W o r k L o g [ ' s t a t u s ' ] )   = >   {  
 	 	 s w i t c h   ( s t a t u s )   {  
 	 	 	 c a s e   ' c r i t i c a l _ u n d e r w o r k ' :   r e t u r n   ' b g - r e d - 1 0 0   t e x t - r e d - 8 0 0 '  
 	 	 	 c a s e   ' c l o s e _ t o _ n o r m ' :   r e t u r n   ' b g - y e l l o w - 1 0 0   t e x t - y e l l o w - 8 0 0 '  
 	 	 	 c a s e   ' e x c e e d _ n o r m ' :   r e t u r n   ' b g - b l u e - 1 0 0   t e x t - b l u e - 8 0 0 '  
 	 	 	 d e f a u l t :   r e t u r n   ' b g - g r e e n - 1 0 0   t e x t - g r e e n - 8 0 0 '  
 	 	 }  
 	 }  
  
 	 c o n s t   g e t S t a t u s I c o n   =   ( s t a t u s :   E m p l o y e e W o r k L o g [ ' s t a t u s ' ] )   = >   {  
 	 	 s w i t c h   ( s t a t u s )   {  
 	 	 	 c a s e   ' c r i t i c a l _ u n d e r w o r k ' :   r e t u r n   < X C i r c l e   c l a s s N a m e = " h - 4   w - 4 "   / >  
 	 	 	 c a s e   ' c l o s e _ t o _ n o r m ' :   r e t u r n   < A l e r t T r i a n g l e   c l a s s N a m e = " h - 4   w - 4 "   / >  
 	 	 	 c a s e   ' e x c e e d _ n o r m ' :   r e t u r n   < B a r C h a r t 3   c l a s s N a m e = " h - 4   w - 4 "   / >  
 	 	 	 d e f a u l t :   r e t u r n   < C h e c k C i r c l e 2   c l a s s N a m e = " h - 4   w - 4 "   / >  
 	 	 }  
 	 }  
  
 	 r e t u r n   (  
 	 	 < d i v   c l a s s N a m e = " s p a c e - y - 6 " >  
 	 	 	 < C a r d >  
 	 	 	 	 < C a r d H e a d e r >  
 	 	 	 	 	 < C a r d T i t l e   c l a s s N a m e = " f l e x   i t e m s - c e n t e r   g a p - 2 " >  
 	 	 	 	 	 	 < U s e r   c l a s s N a m e = " h - 6   w - 6 "   / >  
 	 	 	 	 	 	 5B0;L=K9  >BG5B  ?>  A>B@C4=8:0< 
 	 	 	 	 	 < / C a r d T i t l e >  
 	 	 	 	 	 < C a r d D e s c r i p t i o n >  
 	 	 	 	 	 	 >;=0O  AB0B8AB8:0  @01>BK  :><0=4K  :0:  2  20H59  G o o g l e   S h e e t s   B01;8F5 
 	 	 	 	 	 < / C a r d D e s c r i p t i o n >  
 	 	 	 	 < / C a r d H e a d e r >  
 	 	 	 	 < C a r d C o n t e n t >  
 	 	 	 	 	 < P o p o v e r >  
 	 	 	 	 	 	 < P o p o v e r T r i g g e r   a s C h i l d >  
 	 	 	 	 	 	 	 < B u t t o n   v a r i a n t = " o u t l i n e "   c l a s s N a m e = " w - [ 2 4 0 p x ] " >  
 	 	 	 	 	 	 	 	 < C a l e n d a r I c o n   c l a s s N a m e = " m r - 2   h - 4   w - 4 "   / >  
 	 	 	 	 	 	 	 	 { f o r m a t ( s e l e c t e d D a t e ,   " d   M M M M   y y y y " ,   {   l o c a l e :   r u   } ) }  
 	 	 	 	 	 	 	 < / B u t t o n >  
 	 	 	 	 	 	 < / P o p o v e r T r i g g e r >  
 	 	 	 	 	 	 < P o p o v e r C o n t e n t   c l a s s N a m e = " w - a u t o   p - 0 " >  
 	 	 	 	 	 	 	 < C a l e n d a r  
 	 	 	 	 	 	 	 	 m o d e = " s i n g l e "  
 	 	 	 	 	 	 	 	 s e l e c t e d = { s e l e c t e d D a t e }  
 	 	 	 	 	 	 	 	 o n S e l e c t = { ( d a t e )   = >   d a t e   & &   s e t S e l e c t e d D a t e ( d a t e ) }  
 	 	 	 	 	 	 	 	 d i s a b l e d = { ( d a t e )   = >   d a t e   >   n e w   D a t e ( ) }  
 	 	 	 	 	 	 	 	 i n i t i a l F o c u s  
 	 	 	 	 	 	 	 / >  
 	 	 	 	 	 	 < / P o p o v e r C o n t e n t >  
 	 	 	 	 	 < / P o p o v e r >  
 	 	 	 	 < / C a r d C o n t e n t >  
 	 	 	 < / C a r d >  
  
 	 	 	 { l o a d i n g   ?   (  
 	 	 	 	 < C a r d >  
 	 	 	 	 	 < C a r d C o n t e n t   c l a s s N a m e = " p - 8   t e x t - c e n t e r " >  
 	 	 	 	 	 	 < d i v   c l a s s N a m e = " t e x t - 4 x l   a n i m a t e - s p i n   m b - 4 " > =���< / d i v >  
 	 	 	 	 	 	 < p > 03@C605<  >BG5B. . . < / p >  
 	 	 	 	 	 < / C a r d C o n t e n t >  
 	 	 	 	 < / C a r d >  
 	 	 	 )   :   r e p o r t D a t a   ?   (  
 	 	 	 	 < >  
 	 	 	 	 	 < d i v   c l a s s N a m e = " g r i d   g r i d - c o l s - 2   m d : g r i d - c o l s - 4   g a p - 4 " >  
 	 	 	 	 	 	 < C a r d >  
 	 	 	 	 	 	 	 < C a r d C o n t e n t   c l a s s N a m e = " p - 4   t e x t - c e n t e r " >  
 	 	 	 	 	 	 	 	 < U s e r   c l a s s N a m e = " h - 6   w - 6   m x - a u t o   m b - 2   t e x t - b l u e - 6 0 0 "   / >  
 	 	 	 	 	 	 	 	 < d i v   c l a s s N a m e = " t e x t - 2 x l   f o n t - b o l d " > { r e p o r t D a t a . t o t a l _ e m p l o y e e s } < / d i v >  
 	 	 	 	 	 	 	 	 < d i v   c l a s s N a m e = " t e x t - s m   t e x t - m u t e d - f o r e g r o u n d " > A53>  A>B@C4=8:>2< / d i v >  
 	 	 	 	 	 	 	 < / C a r d C o n t e n t >  
 	 	 	 	 	 	 < / C a r d >  
  
 	 	 	 	 	 	 < C a r d >  
 	 	 	 	 	 	 	 < C a r d C o n t e n t   c l a s s N a m e = " p - 4   t e x t - c e n t e r " >  
 	 	 	 	 	 	 	 	 < C h e c k C i r c l e 2   c l a s s N a m e = " h - 6   w - 6   m x - a u t o   m b - 2   t e x t - g r e e n - 6 0 0 "   / >  
 	 	 	 	 	 	 	 	 < d i v   c l a s s N a m e = " t e x t - 2 x l   f o n t - b o l d " > { r e p o r t D a t a . w o r k i n g _ e m p l o y e e s } < / d i v >  
 	 	 	 	 	 	 	 	 < d i v   c l a s s N a m e = " t e x t - s m   t e x t - m u t e d - f o r e g r o u n d " >  01>B0;8< / d i v >  
 	 	 	 	 	 	 	 < / C a r d C o n t e n t >  
 	 	 	 	 	 	 < / C a r d >  
  
 	 	 	 	 	 	 < C a r d >  
 	 	 	 	 	 	 	 < C a r d C o n t e n t   c l a s s N a m e = " p - 4   t e x t - c e n t e r " >  
 	 	 	 	 	 	 	 	 < T a r g e t   c l a s s N a m e = " h - 6   w - 6   m x - a u t o   m b - 2   t e x t - p u r p l e - 6 0 0 "   / >  
 	 	 	 	 	 	 	 	 < d i v   c l a s s N a m e = " t e x t - 2 x l   f o n t - b o l d " > { r e p o r t D a t a . t o t a l _ u n i t s } < / d i v >  
 	 	 	 	 	 	 	 	 < d i v   c l a s s N a m e = " t e x t - s m   t e x t - m u t e d - f o r e g r o u n d " > 48=8F  2K?>;=5=>< / d i v >  
 	 	 	 	 	 	 	 < / C a r d C o n t e n t >  
 	 	 	 	 	 	 < / C a r d >  
  
 	 	 	 	 	 	 < C a r d >  
 	 	 	 	 	 	 	 < C a r d C o n t e n t   c l a s s N a m e = " p - 4   t e x t - c e n t e r " >  
 	 	 	 	 	 	 	 	 < d i v   c l a s s N a m e = " w - 6   h - 6   m x - a u t o   m b - 2   b g - r e d - 6 0 0   r o u n d e d   t e x t - w h i t e   t e x t - x s   f l e x   i t e m s - c e n t e r   j u s t i f y - c e n t e r   f o n t - b o l d " >  
 	 	 	 	 	 	 	 	 	  
 	 	 	 	 	 	 	 	 < / d i v >  
 	 	 	 	 	 	 	 	 < d i v   c l a s s N a m e = " t e x t - 2 x l   f o n t - b o l d " > { r e p o r t D a t a . m z h i _ d e c i s i o n s } < / d i v >  
 	 	 	 	 	 	 	 	 < d i v   c l a s s N a m e = " t e x t - s m   t e x t - m u t e d - f o r e g r o u n d " >  5H5=89  < / d i v >  
 	 	 	 	 	 	 	 < / C a r d C o n t e n t >  
 	 	 	 	 	 	 < / C a r d >  
 	 	 	 	 	 < / d i v >  
  
 	 	 	 	 	 < C a r d >  
 	 	 	 	 	 	 < C a r d H e a d e r >  
 	 	 	 	 	 	 	 < C a r d T i t l e > 5B0;870F8O  ?>  A>B@C4=8:0<< / C a r d T i t l e >  
 	 	 	 	 	 	 < / C a r d H e a d e r >  
 	 	 	 	 	 	 < C a r d C o n t e n t >  
 	 	 	 	 	 	 	 < d i v   c l a s s N a m e = " s p a c e - y - 4 " >  
 	 	 	 	 	 	 	 	 { r e p o r t D a t a . e m p l o y e e _ l o g s . m a p ( ( e m p l o y e e ,   i n d e x )   = >   (  
 	 	 	 	 	 	 	 	 	 < d i v   k e y = { e m p l o y e e . e m p l o y e e _ i d }   c l a s s N a m e = " b o r d e r   r o u n d e d - l g   p - 4 " >  
 	 	 	 	 	 	 	 	 	 	 < d i v   c l a s s N a m e = " f l e x   i t e m s - c e n t e r   j u s t i f y - b e t w e e n   m b - 4 " >  
 	 	 	 	 	 	 	 	 	 	 	 < d i v   c l a s s N a m e = " f l e x   i t e m s - c e n t e r   g a p - 3 " >  
 	 	 	 	 	 	 	 	 	 	 	 	 < B a d g e   v a r i a n t = { i n d e x   <   3   ?   " d e f a u l t "   :   " s e c o n d a r y " } >  
 	 	 	 	 	 	 	 	 	 	 	 	 	 # { i n d e x   +   1 }  
 	 	 	 	 	 	 	 	 	 	 	 	 < / B a d g e >  
 	 	 	 	 	 	 	 	 	 	 	 	 < d i v >  
 	 	 	 	 	 	 	 	 	 	 	 	 	 < d i v   c l a s s N a m e = " f o n t - m e d i u m " > { e m p l o y e e . f u l l _ n a m e } < / d i v >  
 	 	 	 	 	 	 	 	 	 	 	 	 	 < d i v   c l a s s N a m e = " t e x t - s m   t e x t - m u t e d - f o r e g r o u n d " > { e m p l o y e e . p o s i t i o n } < / d i v >  
 	 	 	 	 	 	 	 	 	 	 	 	 < / d i v >  
 	 	 	 	 	 	 	 	 	 	 	 	 < B a d g e   c l a s s N a m e = { g e t S t a t u s C o l o r ( e m p l o y e e . s t a t u s ) } >  
 	 	 	 	 	 	 	 	 	 	 	 	 	 { g e t S t a t u s I c o n ( e m p l o y e e . s t a t u s ) }  
 	 	 	 	 	 	 	 	 	 	 	 	 	 < s p a n   c l a s s N a m e = " m l - 1 " >  
 	 	 	 	 	 	 	 	 	 	 	 	 	 	 { e m p l o y e e . s t a t u s   = = =   ' c r i t i c a l _ u n d e r w o r k '   ?   ' @8B8G5A:0O  =54>@01>B:0'   :  
 	 	 	 	 	 	 	 	 	 	 	 	 	 	 	 e m p l o y e e . s t a t u s   = = =   ' c l o s e _ t o _ n o r m '   ?   ' ;87:>  :  =>@<5'   :  
 	 	 	 	 	 	 	 	 	 	 	 	 	 	 	 	 e m p l o y e e . s t a t u s   = = =   ' e x c e e d _ n o r m '   ?   ' @52KH5=85  =>@<K'   :   ' >@<0;L=>' }  
 	 	 	 	 	 	 	 	 	 	 	 	 	 < / s p a n >  
 	 	 	 	 	 	 	 	 	 	 	 	 < / B a d g e >  
 	 	 	 	 	 	 	 	 	 	 	 < / d i v >  
  
 	 	 	 	 	 	 	 	 	 	 	 < d i v   c l a s s N a m e = " f l e x   g a p - 6   t e x t - c e n t e r " >  
 	 	 	 	 	 	 	 	 	 	 	 	 < d i v >  
 	 	 	 	 	 	 	 	 	 	 	 	 	 < d i v   c l a s s N a m e = " f o n t - b o l d   t e x t - l g " > { e m p l o y e e . t o t a l _ t a s k s } < / d i v >  
 	 	 	 	 	 	 	 	 	 	 	 	 	 < d i v   c l a s s N a m e = " t e x t - x s   t e x t - m u t e d - f o r e g r o u n d " > 7040G< / d i v >  
 	 	 	 	 	 	 	 	 	 	 	 	 < / d i v >  
 	 	 	 	 	 	 	 	 	 	 	 	 < d i v >  
 	 	 	 	 	 	 	 	 	 	 	 	 	 < d i v   c l a s s N a m e = " f o n t - b o l d   t e x t - l g " > { e m p l o y e e . t o t a l _ u n i t s } < / d i v >  
 	 	 	 	 	 	 	 	 	 	 	 	 	 < d i v   c l a s s N a m e = " t e x t - x s   t e x t - m u t e d - f o r e g r o u n d " > 548=8F< / d i v >  
 	 	 	 	 	 	 	 	 	 	 	 	 < / d i v >  
 	 	 	 	 	 	 	 	 	 	 	 	 < d i v >  
 	 	 	 	 	 	 	 	 	 	 	 	 	 < d i v   c l a s s N a m e = " f o n t - b o l d   t e x t - l g " > { f o r m a t T i m e ( e m p l o y e e . t o t a l _ t i m e ) } < / d i v >  
 	 	 	 	 	 	 	 	 	 	 	 	 	 < d i v   c l a s s N a m e = " t e x t - x s   t e x t - m u t e d - f o r e g r o u n d " > 2@5<O< / d i v >  
 	 	 	 	 	 	 	 	 	 	 	 	 < / d i v >  
 	 	 	 	 	 	 	 	 	 	 	 	 < d i v >  
 	 	 	 	 	 	 	 	 	 	 	 	 	 < d i v   c l a s s N a m e = { ` f o n t - b o l d   t e x t - l g   $ { e m p l o y e e . c o m p l e t i o n _ p e r c e n t a g e   <   5 0   ?   ' t e x t - r e d - 6 0 0 '   :  
 	 	 	 	 	 	 	 	 	 	 	 	 	 	 e m p l o y e e . c o m p l e t i o n _ p e r c e n t a g e   <   8 0   ?   ' t e x t - y e l l o w - 6 0 0 '   :  
 	 	 	 	 	 	 	 	 	 	 	 	 	 	 	 e m p l o y e e . c o m p l e t i o n _ p e r c e n t a g e   >   1 2 0   ?   ' t e x t - b l u e - 6 0 0 '   :   ' t e x t - g r e e n - 6 0 0 '  
 	 	 	 	 	 	 	 	 	 	 	 	 	 	 } ` } >  
 	 	 	 	 	 	 	 	 	 	 	 	 	 	 { e m p l o y e e . c o m p l e t i o n _ p e r c e n t a g e } %  
 	 	 	 	 	 	 	 	 	 	 	 	 	 < / d i v >  
 	 	 	 	 	 	 	 	 	 	 	 	 	 < d i v   c l a s s N a m e = " t e x t - x s   t e x t - m u t e d - f o r e g r o u n d " > >B  =>@<K< / d i v >  
 	 	 	 	 	 	 	 	 	 	 	 	 < / d i v >  
 	 	 	 	 	 	 	 	 	 	 	 < / d i v >  
 	 	 	 	 	 	 	 	 	 	 < / d i v >  
  
 	 	 	 	 	 	 	 	 	 	 { e m p l o y e e . t a s k _ b r e a k d o w n . l e n g t h   >   0   & &   (  
 	 	 	 	 	 	 	 	 	 	 	 < d i v   c l a s s N a m e = " m t - 3 " >  
 	 	 	 	 	 	 	 	 	 	 	 	 < d i v   c l a s s N a m e = " t e x t - s m   f o n t - m e d i u m   t e x t - m u t e d - f o r e g r o u n d   m b - 2 " >  
 	 	 	 	 	 	 	 	 	 	 	 	 	  07182:0  ?>  7040G0<:  
 	 	 	 	 	 	 	 	 	 	 	 	 < / d i v >  
 	 	 	 	 	 	 	 	 	 	 	 	 < d i v   c l a s s N a m e = " g r i d   g r i d - c o l s - 1   m d : g r i d - c o l s - 2   l g : g r i d - c o l s - 3   g a p - 2 " >  
 	 	 	 	 	 	 	 	 	 	 	 	 	 { e m p l o y e e . t a s k _ b r e a k d o w n . s l i c e ( 0 ,   6 ) . m a p ( ( t a s k ,   t a s k I n d e x )   = >   (  
 	 	 	 	 	 	 	 	 	 	 	 	 	 	 < d i v   k e y = { t a s k I n d e x }   c l a s s N a m e = " p - 2   b g - m u t e d / 5 0   r o u n d e d   t e x t - s m " >  
 	 	 	 	 	 	 	 	 	 	 	 	 	 	 	 < d i v   c l a s s N a m e = " f o n t - m e d i u m   t r u n c a t e "   t i t l e = { t a s k . t a s k _ n a m e } >  
 	 	 	 	 	 	 	 	 	 	 	 	 	 	 	 	 { t a s k . t a s k _ n a m e }  
 	 	 	 	 	 	 	 	 	 	 	 	 	 	 	 < / d i v >  
 	 	 	 	 	 	 	 	 	 	 	 	 	 	 	 < d i v   c l a s s N a m e = " f l e x   j u s t i f y - b e t w e e n   t e x t - x s   t e x t - m u t e d - f o r e g r o u n d " >  
 	 	 	 	 	 	 	 	 	 	 	 	 	 	 	 	 < s p a n > { t a s k . u n i t s }   54. < / s p a n >  
 	 	 	 	 	 	 	 	 	 	 	 	 	 	 	 	 < s p a n > { f o r m a t T i m e ( t a s k . t i m e ) } < / s p a n >  
 	 	 	 	 	 	 	 	 	 	 	 	 	 	 	 	 < s p a n > { t a s k . p e r c e n t a g e } % < / s p a n >  
 	 	 	 	 	 	 	 	 	 	 	 	 	 	 	 < / d i v >  
 	 	 	 	 	 	 	 	 	 	 	 	 	 	 < / d i v >  
 	 	 	 	 	 	 	 	 	 	 	 	 	 ) ) }  
 	 	 	 	 	 	 	 	 	 	 	 	 < / d i v >  
 	 	 	 	 	 	 	 	 	 	 	 < / d i v >  
 	 	 	 	 	 	 	 	 	 	 ) }  
 	 	 	 	 	 	 	 	 	 < / d i v >  
 	 	 	 	 	 	 	 	 ) ) }  
 	 	 	 	 	 	 	 < / d i v >  
 	 	 	 	 	 	 < / C a r d C o n t e n t >  
 	 	 	 	 	 < / C a r d >  
 	 	 	 	 < / >  
 	 	 	 )   :   (  
 	 	 	 	 < C a r d >  
 	 	 	 	 	 < C a r d C o n t e n t   c l a s s N a m e = " p - 8   t e x t - c e n t e r " >  
 	 	 	 	 	 	 < C a l e n d a r I c o n   c l a s s N a m e = " h - 1 2   w - 1 2   m x - a u t o   m b - 4   t e x t - m u t e d - f o r e g r o u n d "   / >  
 	 	 	 	 	 	 < p   c l a s s N a m e = " t e x t - m u t e d - f o r e g r o u n d " > K15@8B5  40BC  4;O  703@C7:8  >BG5B0< / p >  
 	 	 	 	 	 < / C a r d C o n t e n t >  
 	 	 	 	 < / C a r d >  
 	 	 	 ) }  
 	 	 < / d i v >  
 	 )  
 }  
 